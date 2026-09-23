// @vitest-environment node
/**
 * DEC-037 migration on a REAL Postgres (PGlite — no Docker, no network, per
 * docs/NO_LOCAL_DOCKER_POLICY.md Tier 1).
 *
 * Proves: the migration applies on top of every earlier one; the new tables
 * carry household RLS exactly like the existing ones; a member of another
 * household cannot read or write them (acceptance 20); dish versions are
 * immutable-by-use (a new revision is a new row); food_entries keeps the
 * provenance columns; the owner wrapper is idempotent, records the ledger row
 * and leaves every existing count untouched (acceptance 24).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const DEC037_MIGRATION = "20260923090000_dishes_bridges_estimated.sql";
const SKIP = new Set([
  "20260723090300_realtime.sql",
  "20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
]);

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** A user of a DIFFERENT household — the negative RLS case. */
const STRANGER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let db: PGlite;
let household = "";
let otherHousehold = "";
let ariel = "";

async function asUser<T>(sub: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`insert into auth.users (id) values ('${sub}') on conflict do nothing`);
  const claims = JSON.stringify({ sub, role: "authenticated", is_anonymous: true });
  await db.exec(
    `select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

async function count(sql: string): Promise<number> {
  const r = await db.query<{ n: string | number }>(sql);
  return Number(r.rows[0].n);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (SKIP.has(file)) continue;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  // One household with the two profiles, and a second household for the
  // negative RLS case.
  household = await asUser(DEVICE_A, async () => {
    const r = await db.query<{ hid: string }>("select public.bootstrap_household() as hid");
    return r.rows[0].hid;
  });
  await asUser(DEVICE_B, async () => {
    await db.query("select public.bootstrap_household()");
  });
  const other = await db.query<{ id: string }>(
    "insert into public.households (name) values ('אחר') returning id",
  );
  otherHousehold = other.rows[0].id;
  await db.exec(`insert into auth.users (id) values ('${STRANGER}') on conflict do nothing`);
  await db.query(
    `insert into public.household_users (household_id, user_id, role) values ('${otherHousehold}', '${STRANGER}', 'owner')`,
  );
  ariel = (
    await db.query<{ id: string }>(
      `select id from public.profiles where household_id = '${household}' and slug = 'ariel'`,
    )
  ).rows[0].id;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("DEC-037 schema", () => {
  it("creates the four tables with RLS and the food_entries provenance columns", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname in ('dishes','dish_versions','estimated_products','weight_bridges')
       order by c.relname`,
    );
    expect(tables.rows).toEqual([
      { relname: "dish_versions", relrowsecurity: true },
      { relname: "dishes", relrowsecurity: true },
      { relname: "estimated_products", relrowsecurity: true },
      { relname: "weight_bridges", relrowsecurity: true },
    ]);
    const cols = await db.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
       where table_name = 'food_entries'
         and column_name in ('dish_id','dish_revision','estimated_product_id','consumed_weight_g','weight_source')
       order by column_name`,
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual([
      "consumed_weight_g",
      "dish_id",
      "dish_revision",
      "estimated_product_id",
      "weight_source",
    ]);
    // every new column is nullable → additive and backward-compatible
    expect(cols.rows.every((c) => c.is_nullable === "YES")).toBe(true);
  });

  it("anon has no access; authenticated has CRUD except on the append-only versions", async () => {
    const grants = await db.query<{ grantee: string; table_name: string }>(
      `select distinct grantee, table_name from information_schema.role_table_grants
       where table_schema = 'public'
         and table_name in ('dishes','dish_versions','estimated_products','weight_bridges')
         and grantee in ('anon','authenticated') order by grantee, table_name`,
    );
    expect(grants.rows.filter((g) => g.grantee === "anon")).toHaveLength(0);
    expect(grants.rows.filter((g) => g.grantee === "authenticated")).toHaveLength(4);

    // A revision snapshot is evidence for a meal that is already logged: no
    // member may rewrite or erase one, by privilege AND by policy.
    const perTable = await db.query<{ table_name: string; privs: string }>(
      `select table_name, string_agg(distinct privilege_type, ',' order by privilege_type) as privs
       from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
         and table_name in ('dishes','dish_versions','estimated_products','weight_bridges')
       group by table_name order by table_name`,
    );
    expect(Object.fromEntries(perTable.rows.map((r) => [r.table_name, r.privs]))).toEqual({
      dish_versions: "INSERT,SELECT",
      dishes: "DELETE,INSERT,SELECT,UPDATE",
      estimated_products: "DELETE,INSERT,SELECT,UPDATE",
      weight_bridges: "DELETE,INSERT,SELECT,UPDATE",
    });
    const policies = await db.query<{ cmd: string }>(
      `select cmd from pg_policies where schemaname = 'public' and tablename = 'dish_versions'
       order by cmd`,
    );
    expect(policies.rows.map((r) => r.cmd).sort()).toEqual(["INSERT", "SELECT"]);
    await db.exec("set role anon");
    try {
      await expect(db.query("select count(*) from public.dishes")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });

  it("rejects an invalid label basis, provenance, weight source and non-positive weight", async () => {
    const base = `insert into public.estimated_products
      (household_id, name, normalized_name, label_basis, label_calories, points_per_100g)`;
    await expect(
      db.query(`${base} values ('${household}', 'x', 'x', 'per_kg', 100, 5)`),
    ).rejects.toThrow(/check constraint/);
    // per_serving without a serving weight is refused by the dedicated constraint
    await expect(
      db.query(`${base} values ('${household}', 'y', 'y', 'per_serving', 100, 5)`),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        `insert into public.weight_bridges (household_id, source_kind, source_key, unit, grams_per_unit, provenance)
         values ('${household}', 'reference', 'k', 'כף', 15, 'guessed')`,
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        `insert into public.weight_bridges (household_id, source_kind, source_key, unit, grams_per_unit, provenance)
         values ('${household}', 'reference', 'k', 'כף', 0, 'label')`,
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        `insert into public.dishes (household_id, name, normalized_name, total_points, final_weight_g, points_per_gram)
         values ('${household}', 'd', 'd', 10, 0, 1)`,
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("DEC-037 household sharing and RLS (acceptance 20, 21)", () => {
  it("a member writes a dish + version and the PARTNER's device reads them", async () => {
    await asUser(DEVICE_A, async () => {
      await db.query(
        `insert into public.dishes (id, household_id, name, normalized_name, revision, total_points, final_weight_g, points_per_gram, usual_serving_weight_g, created_by_profile_id)
         values ('11111111-1111-4111-8111-111111111111', '${household}', 'תבשיל עדשים', 'תבשיל עדשים', 1, 10, 800, 0.0125, 250, '${ariel}')`,
      );
      await db.query(
        `insert into public.dish_versions (dish_id, household_id, revision, name, total_points, final_weight_g, points_per_gram, ingredients, created_by_profile_id)
         values ('11111111-1111-4111-8111-111111111111', '${household}', 1, 'תבשיל עדשים', 10, 800, 0.0125,
                 '[{"sourceKind":"reference","name":"עדשים","amount":200,"unit":"גרם","basisText":"100 גרם","points":6}]'::jsonb, '${ariel}')`,
      );
      await db.query(
        `insert into public.estimated_products (household_id, name, normalized_name, label_basis, label_calories, points_per_100g, created_by_profile_id)
         values ('${household}', 'קרקר', 'קרקר', 'per_100g', 400, 6, '${ariel}')`,
      );
    });
    await asUser(DEVICE_B, async () => {
      expect(await count(`select count(*) as n from public.dishes`)).toBe(1);
      expect(await count(`select count(*) as n from public.dish_versions`)).toBe(1);
      expect(await count(`select count(*) as n from public.estimated_products`)).toBe(1);
      const ing = await db.query<{ n: string }>(
        "select jsonb_array_length(ingredients)::text as n from public.dish_versions",
      );
      expect(Number(ing.rows[0].n)).toBe(1);
    });
  });

  it("20. a member of ANOTHER household can neither read nor write them", async () => {
    await asUser(STRANGER, async () => {
      expect(await count("select count(*) as n from public.dishes")).toBe(0);
      expect(await count("select count(*) as n from public.dish_versions")).toBe(0);
      expect(await count("select count(*) as n from public.estimated_products")).toBe(0);
      expect(await count("select count(*) as n from public.weight_bridges")).toBe(0);
      // writing INTO the other household is refused by the insert policy
      await expect(
        db.query(
          `insert into public.dishes (household_id, name, normalized_name, total_points, final_weight_g, points_per_gram)
           values ('${household}', 'גניבה', 'גניבה', 1, 100, 0.01)`,
        ),
      ).rejects.toThrow(/row-level security/);
      // and updating a row it cannot see changes nothing
      const res = await db.query("update public.dishes set name = 'שונה' where true returning id");
      expect(res.rows).toHaveLength(0);
    });
    // the original row is intact
    const name = await db.query<{ name: string }>("select name from public.dishes limit 1");
    expect(name.rows[0].name).toBe("תבשיל עדשים");
  });

  it("a new revision is a NEW immutable version row; the old one is untouched", async () => {
    await asUser(DEVICE_A, async () => {
      await db.query(
        `insert into public.dish_versions (dish_id, household_id, revision, name, total_points, final_weight_g, points_per_gram, ingredients)
         values ('11111111-1111-4111-8111-111111111111', '${household}', 2, 'תבשיל עדשים', 16, 800, 0.02, '[]'::jsonb)`,
      );
      await db.query(
        `update public.dishes set revision = 2, total_points = 16, points_per_gram = 0.02
         where id = '11111111-1111-4111-8111-111111111111'`,
      );
      // the same revision twice is refused (the queue may replay it)
      await expect(
        db.query(
          `insert into public.dish_versions (dish_id, household_id, revision, name, total_points, final_weight_g, points_per_gram, ingredients)
           values ('11111111-1111-4111-8111-111111111111', '${household}', 2, 'x', 1, 1, 1, '[]'::jsonb)`,
        ),
      ).rejects.toThrow(/duplicate key/);
    });
    const v1 = await db.query<{ total_points: string }>(
      "select total_points::text from public.dish_versions where revision = 1",
    );
    expect(v1.rows[0].total_points).toBe("10");

    // A member of the household cannot rewrite or erase a stored revision.
    await asUser(DEVICE_A, async () => {
      await expect(
        db.query("update public.dish_versions set total_points = 999 where revision = 1"),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.dish_versions where revision = 1")).rejects.toThrow(
        /permission denied/,
      );
    });
    const after = await db.query<{ total_points: string }>(
      "select total_points::text from public.dish_versions where revision = 1",
    );
    expect(after.rows[0].total_points).toBe("10");
  });

  it("a meal entry keeps its dish/estimated provenance and survives the dish changing", async () => {
    const entryId = "22222222-2222-4222-8222-222222222222";
    await asUser(DEVICE_A, async () => {
      await db.query(
        `insert into public.food_entries (id, household_id, profile_id, log_date, slot, food_name, quantity_mode, amount, unit,
           points_value, points_model_version, points_basis, dish_id, dish_revision, consumed_weight_g, weight_source)
         values ('${entryId}', '${household}', '${ariel}', '2026-09-23', 'main_meal', 'תבשיל עדשים', 'measured', 250, 'גרם',
           3, 'ref-v1', 'dish:weighed', '11111111-1111-4111-8111-111111111111', 1, 250, 'weighed')`,
      );
    });
    // the dish is edited again (service role, as a migration/partner would)
    await db.query(
      `update public.dishes set points_per_gram = 0.5, revision = 3 where id = '11111111-1111-4111-8111-111111111111'`,
    );
    const row = await db.query<{
      points_value: string;
      dish_revision: number;
      weight_source: string;
      points_basis: string;
    }>(
      `select points_value::text, dish_revision, weight_source, points_basis from public.food_entries where id = '${entryId}'`,
    );
    expect(row.rows[0]).toEqual({
      points_value: "3",
      dish_revision: 1,
      weight_source: "weighed",
      points_basis: "dish:weighed",
    });
    await expect(
      db.query(`update public.food_entries set weight_source = 'guessed' where id = '${entryId}'`),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("DEC-037 production wrapper", () => {
  it("applies on a fresh database, is idempotent, records the ledger row and changes no count", async () => {
    const fresh = new PGlite({ extensions: { pgcrypto } });
    try {
      await fresh.exec(`
        create schema auth;
        create table auth.users (id uuid primary key);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
        $$;
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
        grant usage on schema public to anon, authenticated, service_role;
        create publication supabase_realtime;
        create schema supabase_migrations;
        create table supabase_migrations.schema_migrations (
          version text primary key, name text, statements text[]
        );
      `);
      for (const file of readdirSync(MIGRATIONS).sort()) {
        if (SKIP.has(file) || file === DEC037_MIGRATION) continue;
        await fresh.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
      }
      // Some existing data to prove the apply does not touch it.
      await fresh.exec(`insert into auth.users (id) values ('${DEVICE_A}')`);
      await fresh.exec(
        `select set_config('request.jwt.claims', '${JSON.stringify({ sub: DEVICE_A, role: "authenticated" })}', false); set role authenticated;`,
      );
      await fresh.query("select public.bootstrap_household()");
      await fresh.exec("reset role; select set_config('request.jwt.claims', '', false);");
      const countsSql = `select (select count(*) from public.households) as h,
                                (select count(*) from public.profiles) as p,
                                (select count(*) from public.foods) as f,
                                (select count(*) from public.food_entries) as e`;
      const before = (await fresh.query(countsSql)).rows[0];

      const wrapper = readFileSync(
        join(process.cwd(), "supabase", "apply_dishes_bridges_estimated_production.sql"),
        "utf8",
      );
      await fresh.exec(wrapper);
      await fresh.exec(wrapper); // second run: no error, no duplicate

      expect((await fresh.query(countsSql)).rows[0]).toEqual(before);
      const ledger = await fresh.query<{ version: string; name: string }>(
        "select version, name from supabase_migrations.schema_migrations where version = '20260923090000'",
      );
      expect(ledger.rows).toEqual([
        { version: "20260923090000", name: "dishes_bridges_estimated" },
      ]);
      const tables = await fresh.query<{ n: string }>(
        `select count(*)::text as n from information_schema.tables where table_schema = 'public'
         and table_name in ('dishes','dish_versions','estimated_products','weight_bridges')`,
      );
      expect(Number(tables.rows[0].n)).toBe(4);
    } finally {
      await fresh.close();
    }
  });
});
