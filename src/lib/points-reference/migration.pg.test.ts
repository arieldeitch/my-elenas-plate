// @vitest-environment node
/**
 * Deterministic Postgres test of the points-reference migration (DEC-035)
 * using the REAL migration SQL inside an in-process Postgres (PGlite — no
 * Docker, no network, docs/NO_LOCAL_DOCKER_POLICY.md Tier 1).
 *
 * Proves: the DDL applies on top of every earlier migration; the generated
 * seed is idempotent (re-running changes nothing); the reference is readable
 * by an authenticated member and NOT writable by it; custom foods keep their
 * owner; entry snapshots keep their provenance and are never rewritten when
 * the reference row changes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { BEGIN_MARKER, END_MARKER } from "../../../scripts/points-reference/seed-sql";
import dataset from "@/data/points-reference/reference.v1.json";
import aliasFile from "@/data/points-reference/aliases.v1.json";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const REFERENCE_MIGRATION = "20260921120000_points_reference.sql";
const ALIAS_MIGRATION = "20260922090000_reference_only_foods.sql";
const SKIP = new Set([
  "20260723090300_realtime.sql",
  "20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
]);

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;

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

const seedBlock = () => {
  const text = readFileSync(join(MIGRATIONS, REFERENCE_MIGRATION), "utf8");
  return text.slice(text.indexOf(BEGIN_MARKER) + BEGIN_MARKER.length, text.indexOf(END_MARKER));
};

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
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("points reference migration (DEC-035)", () => {
  it("seeds every dataset row exactly once, with verbatim source values", async () => {
    expect(await count("select count(*) as n from public.food_reference_items")).toBe(
      dataset.items.length,
    );
    const src = await db.query<{ version: string; sha256: string }>(
      "select version, sha256 from public.food_reference_sources",
    );
    expect(src.rows).toEqual([{ version: dataset.source.version, sha256: dataset.source.sha256 }]);
    const avocado = await db.query<{
      source_name: string;
      source_quantity_text: string;
      source_points: string;
      status: string;
    }>(
      "select source_name, source_quantity_text, source_points::text, status from public.food_reference_items where source_row = 3",
    );
    expect(avocado.rows[0]).toEqual({
      source_name: "אבוקדו",
      source_quantity_text: "30 גרם",
      source_points: "1",
      status: "active",
    });
  });

  it("re-running the seed is idempotent (no duplicates, no changed rows)", async () => {
    const before = await db.query<{
      id: string;
      points: string;
      status: string;
      benefit_of: string | null;
    }>(
      "select id, points::text, status, benefit_of from public.food_reference_items order by source_row",
    );
    await db.exec(seedBlock());
    await db.exec(seedBlock());
    const after = await db.query<{
      id: string;
      points: string;
      status: string;
      benefit_of: string | null;
    }>(
      "select id, points::text, status, benefit_of from public.food_reference_items order by source_row",
    );
    expect(after.rows).toEqual(before.rows);
    expect(await count("select count(*) as n from public.food_reference_items")).toBe(
      dataset.items.length,
    );
    expect(await count("select count(*) as n from public.food_reference_sources")).toBe(1);
  });

  it("keeps the two declared conflicts and the hidden statuses", async () => {
    const yogurt = await db.query<{ points: string; status: string }>(
      "select points::text, status from public.food_reference_items where source_row in (568, 569) order by source_row",
    );
    expect(yogurt.rows).toEqual([
      { points: "4", status: "conflict" },
      { points: "5", status: "conflict" },
    ]);
    const rice = await db.query<{ status: string; category: string }>(
      "select status, category from public.food_reference_items where source_row in (794, 795) order by source_row",
    );
    expect(rice.rows.map((r) => r.status)).toEqual(["conflict", "conflict"]);
    expect(
      await count(
        "select count(*) as n from public.food_reference_items where status = 'deprecated'",
      ),
    ).toBe(2);
    const fixed = await db.query<{ source_category: string; category: string }>(
      "select source_category, category from public.food_reference_items where source_row = 566",
    );
    expect(fixed.rows[0]).toEqual({ source_category: "חלבון מהח", category: "חלבון מהחי" });
  });

  it("benefit rows are attached to their base food (fruit allowance) — never merged", async () => {
    const pear = await db.query<{
      source_row: number;
      points: string;
      rule: string | null;
      benefit_of: string | null;
    }>(
      "select source_row, points::text, rule, benefit_of from public.food_reference_items where normalized_name like 'אגס%' order by source_row",
    );
    const base = pear.rows.find((r) => r.rule == null)!;
    const benefit = pear.rows.find((r) => r.rule === "fruit_daily_allowance")!;
    expect(base.points).toBe("2");
    expect(benefit.points).toBe("0");
    expect(benefit.benefit_of).not.toBeNull();
    const baseId = await db.query<{ id: string }>(
      `select id from public.food_reference_items where source_row = ${base.source_row}`,
    );
    expect(benefit.benefit_of).toBe(baseId.rows[0].id);
  });

  it("an authenticated member can READ the reference but cannot write it", async () => {
    await asUser(DEVICE_A, async () => {
      await db.query("select public.bootstrap_household()");
      const n = await count(
        "select count(*) as n from public.food_reference_items where status = 'active'",
      );
      expect(n).toBeGreaterThan(1000);
      await expect(
        db.query("update public.food_reference_items set points = 99 where source_row = 3"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query(
          "insert into public.food_reference_aliases (item_id, alias, normalized_alias) select id, 'x', 'x' from public.food_reference_items limit 1",
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("anon has no access to the reference", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select count(*) from public.food_reference_items")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });

  it("custom foods carry their creator; entries keep a provenance snapshot that a reference edit does not change", async () => {
    const hid = (await db.query<{ id: string }>("select id from public.households limit 1")).rows[0]
      .id;
    const profiles = await db.query<{ id: string; slug: string }>(
      "select id, slug from public.profiles order by sort_order",
    );
    const ariel = profiles.rows.find((p) => p.slug === "ariel")!.id;
    const elena = profiles.rows.find((p) => p.slug === "alena")!.id;
    const ref = (
      await db.query<{ id: string }>(
        "select id from public.food_reference_items where source_row = 3",
      )
    ).rows[0].id;

    await asUser(DEVICE_A, async () => {
      await db.query(
        `insert into public.foods (household_id, name, normalized_name, portion_amount, portion_unit, points_per_portion, points_status, created_by_profile_id, points_confirmed_at)
         values ('${hid}', 'קרקר של סבתא', 'קרקר של סבתא', 1, 'יחידה', 1.5, 'confirmed', '${ariel}', now())`,
      );
      await db.query(
        `insert into public.food_entries (household_id, profile_id, log_date, slot, food_name, quantity_mode, amount, unit,
           points_value, points_model_version, points_basis, reference_item_id, base_points)
         values ('${hid}', '${ariel}', '2026-09-21', 'main_meal', 'אבוקדו', 'measured', 60, 'גרם', 2, 'v2-il', 'reference:scaled', '${ref}', 2)`,
      );
    });
    // Elena's device sees Ariel's custom food (shared household) with its owner recorded.
    await asUser(DEVICE_B, async () => {
      await db.query("select public.bootstrap_household()");
      const f = await db.query<{ created_by_profile_id: string; points_status: string }>(
        "select created_by_profile_id, points_status from public.foods where name = 'קרקר של סבתא'",
      );
      expect(f.rows[0]).toEqual({ created_by_profile_id: ariel, points_status: "confirmed" });
      expect(f.rows[0].created_by_profile_id).not.toBe(elena);
    });
    // The reference row changes (service role / migration) — the snapshot does not.
    await db.query(`update public.food_reference_items set points = 5 where id = '${ref}'`);
    const snap = await db.query<{ points_value: string; points_basis: string; food_name: string }>(
      "select points_value::text, points_basis, food_name from public.food_entries where food_name = 'אבוקדו'",
    );
    expect(snap.rows[0]).toEqual({
      points_value: "2",
      points_basis: "reference:scaled",
      food_name: "אבוקדו",
    });
    await db.query(`update public.food_reference_items set points = 1 where id = '${ref}'`);
  });

  it("DEC-036: the verified aliases are seeded, readable by a member, not writable; a personal alias stores its link", async () => {
    const apple = await db.query<{ alias: string; display_name: string; verified: boolean }>(
      "select a.alias, i.display_name, a.verified from public.food_reference_aliases a join public.food_reference_items i on i.id = a.item_id where a.normalized_alias = 'תפוח'",
    );
    expect(apple.rows).toEqual([{ alias: "תפוח", display_name: "תפוח עץ", verified: true }]);
    const hid = (await db.query<{ id: string }>("select id from public.households limit 1")).rows[0]
      .id;
    await asUser(DEVICE_A, async () => {
      const n = await count(
        "select count(*) as n from public.food_reference_aliases where verified",
      );
      expect(n).toBe(aliasFile.aliases.length);
      await expect(
        db.query("update public.food_reference_aliases set verified = false"),
      ).rejects.toThrow(/permission denied/);
      await db.query(
        `insert into public.foods (household_id, name, normalized_name, reference_group_key)
         values ('${hid}', 'המלפפון שלי', 'המלפפון שלי', 'מלפפון')`,
      );
    });
    const row = await db.query<{ reference_group_key: string; points_status: string }>(
      "select reference_group_key, points_status from public.foods where name = 'המלפפון שלי'",
    );
    expect(row.rows[0]).toEqual({ reference_group_key: "מלפפון", points_status: "unscored" });
  });

  it("rejects an unknown status / rule / benefit value", async () => {
    await expect(
      db.query("update public.food_reference_items set status = 'guess' where source_row = 3"),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query("update public.food_entries set benefit_rule = 'twice' where food_name = 'אבוקדו'"),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("production apply wrapper (owner-run SQL)", () => {
  it("applies on a fresh database, records the ledger row, and is idempotent", async () => {
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
        if (SKIP.has(file) || file === REFERENCE_MIGRATION || file === ALIAS_MIGRATION) continue;
        await fresh.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
      }
      const wrapper = readFileSync(
        join(process.cwd(), "supabase", "apply_points_reference_production.sql"),
        "utf8",
      );
      await fresh.exec(wrapper);
      await fresh.exec(wrapper); // second run: no duplicates, no error
      const n = await fresh.query<{ n: string }>(
        "select count(*) as n from public.food_reference_items",
      );
      expect(Number(n.rows[0].n)).toBe(dataset.items.length);
      const ledger = await fresh.query<{ version: string; name: string }>(
        "select version, name from supabase_migrations.schema_migrations where version = '20260921120000'",
      );
      expect(ledger.rows).toEqual([{ version: "20260921120000", name: "points_reference" }]);

      // DEC-036 wrapper on top: before/after counts identical, aliases seeded, ledger row, idempotent.
      const countsSql =
        "select (select count(*) from public.households) as h, (select count(*) from public.profiles) as p, (select count(*) from public.foods) as f, (select count(*) from public.food_entries) as e";
      const before = (await fresh.query(countsSql)).rows[0];
      const aliasWrapper = readFileSync(
        join(process.cwd(), "supabase", "apply_reference_only_foods_production.sql"),
        "utf8",
      );
      await fresh.exec(aliasWrapper);
      await fresh.exec(aliasWrapper);
      const after = (await fresh.query(countsSql)).rows[0];
      expect(after).toEqual(before);
      const aliases = await fresh.query<{ n: string }>(
        "select count(*) as n from public.food_reference_aliases where verified",
      );
      expect(Number(aliases.rows[0].n)).toBe(aliasFile.aliases.length);
      const col = await fresh.query<{ column_name: string; is_nullable: string }>(
        "select column_name, is_nullable from information_schema.columns where table_name = 'foods' and column_name = 'reference_group_key'",
      );
      expect(col.rows).toEqual([{ column_name: "reference_group_key", is_nullable: "YES" }]);
      const ledger2 = await fresh.query<{ version: string; name: string }>(
        "select version, name from supabase_migrations.schema_migrations where version = '20260922090000'",
      );
      expect(ledger2.rows).toEqual([{ version: "20260922090000", name: "reference_only_foods" }]);
    } finally {
      await fresh.close();
    }
  });
});
