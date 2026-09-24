// @vitest-environment node
/**
 * DEC-038 migration on a REAL Postgres (PGlite — no Docker, no network).
 *
 * Proves the private body boundary under ONE shared Auth account:
 *  - the shared authenticated role cannot read, write or subscribe to
 *    weigh_ins directly (acceptance 10, 15);
 *  - without the correct PIN the body functions refuse (acceptance 8);
 *  - one profile's PIN cannot read or write the other profile (acceptance 9);
 *  - a weigh-in that existed before the migration is visible to its owner
 *    after the PIN is set (acceptance 11);
 *  - the PIN is stored only as a salted bcrypt hash; the PIN table is closed;
 *  - calculated_products follows the household RLS pattern.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const SKIP = new Set([
  "20260723090300_realtime.sql",
  "20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
]);
const DEC038 = "20260924090000_calculated_products_private_body.sql";

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STRANGER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OLD_ROW = "11111111-1111-4111-8111-111111111111";

let db: PGlite;
let household = "";
let ariel = "";
let elena = "";

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

/** Opens the capability window a data RPC requires. Returns the unlock verdict. */
async function unlock(profile: string, pin: string, user = DEVICE_A): Promise<string> {
  const r = await asUser(user, () =>
    db.query<{ v: string }>(`select public.body_unlock('${profile}', '${pin}') as v`),
  );
  return r.rows[0].v;
}

async function fails(sql: string, user = DEVICE_A): Promise<string> {
  try {
    await asUser(user, () => db.query(sql));
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error(`expected failure: ${sql}`);
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
  const files = readdirSync(MIGRATIONS).sort();
  // Everything BEFORE DEC-038 first, so a weigh-in can exist before it lands.
  for (const file of files) {
    if (SKIP.has(file) || file >= DEC038) continue;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  // Realtime publication had weigh_ins before (skipped file, emulated here).
  await db.exec("alter publication supabase_realtime add table public.weigh_ins");
  household = await asUser(DEVICE_A, async () => {
    const r = await db.query<{ hid: string }>("select public.bootstrap_household() as hid");
    return r.rows[0].hid;
  });
  const profiles = await db.query<{ id: string; slug: string }>(
    `select id, slug from public.profiles where household_id = '${household}'`,
  );
  ariel = profiles.rows.find((p) => p.slug === "ariel")!.id;
  elena = profiles.rows.find((p) => p.slug !== "ariel")!.id;
  await db.query(
    `insert into public.weigh_ins (id, household_id, profile_id, measured_on, weight_kg, body_fat_pct)
     values ('${OLD_ROW}', '${household}', '${ariel}', '2026-08-01', 82.4, 24.1)`,
  );
  for (const file of files) {
    if (SKIP.has(file) || file < DEC038) continue;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  const other = await db.query<{ id: string }>(
    "insert into public.households (name) values ('אחר') returning id",
  );
  await db.exec(`insert into auth.users (id) values ('${STRANGER}') on conflict do nothing`);
  await db.query(
    `insert into public.household_users (household_id, user_id, role) values ('${other.rows[0].id}', '${STRANGER}', 'owner')`,
  );
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("DEC-038 private body boundary", () => {
  it("the shared account has no direct access to weigh_ins or the PIN table", async () => {
    expect(await fails("select * from public.weigh_ins")).toMatch(/permission denied/);
    expect(
      await fails(
        `insert into public.weigh_ins (household_id, profile_id, measured_on, weight_kg)
         values ('${household}', '${elena}', '2026-09-01', 60)`,
      ),
    ).toMatch(/permission denied/);
    expect(await fails("select * from public.body_privacy")).toMatch(/permission denied/);
    expect(await fails(`select public.body_check_pin('${ariel}', '1')`)).toMatch(
      /permission denied/,
    );
  });

  it("weigh_ins leaves the realtime publication", async () => {
    const r = await db.query(
      "select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'weigh_ins'",
    );
    expect(r.rows).toHaveLength(0);
  });

  it("stays locked until a PIN is set, then shows the pre-migration row to its owner", async () => {
    const status = await asUser(DEVICE_A, () =>
      db.query<{ s: string }>(`select public.body_pin_status('${ariel}') as s`),
    );
    expect(status.rows[0].s).toBe("unset");
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '123456')`)).toMatch(
      /body_pin_unset/,
    );
    expect(await fails(`select public.body_set_pin('${ariel}', '12a4')`)).toMatch(/body_pin_format/);

    await asUser(DEVICE_A, () => db.query(`select public.body_set_pin('${ariel}', '123456')`));
    // Setting the PIN does not unlock: the capability is taken explicitly.
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '123456')`)).toMatch(
      /body_pin_locked/,
    );
    expect(await unlock(ariel, "123456")).toBe("ok");
    const rows = await asUser(DEVICE_A, () =>
      db.query<{ id: string; weight_kg: string }>(
        `select * from public.body_list_weigh_ins('${ariel}', '123456')`,
      ),
    );
    expect(rows.rows.map((r) => r.id)).toEqual([OLD_ROW]);
    expect(Number(rows.rows[0].weight_kg)).toBe(82.4);

    const hash = await db.query<{ pin_hash: string }>(
      `select pin_hash from public.body_privacy where profile_id = '${ariel}'`,
    );
    expect(hash.rows[0].pin_hash).not.toContain("123456");
    expect(hash.rows[0].pin_hash).toMatch(/^\$2[aby]\$/);
  });

  it("a wrong PIN and the other profile's PIN are refused for reads and writes", async () => {
    await asUser(DEVICE_A, () => db.query(`select public.body_set_pin('${elena}', '654321')`));
    expect(await unlock(ariel, "123456")).toBe("ok");
    expect(await unlock(elena, "654321")).toBe("ok");
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '000000')`)).toMatch(
      /body_pin_invalid/,
    );
    // Elena's PIN does not open Ariel's history.
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '654321')`)).toMatch(
      /body_pin_invalid/,
    );
    // ...nor write into it.
    expect(
      await fails(
        `select public.body_save_weigh_in('${ariel}', '654321', null, '2026-09-02', null, 70, null)`,
      ),
    ).toMatch(/body_pin_invalid/);
    // A correct Elena PIN cannot overwrite Ariel's row by id.
    expect(
      await fails(
        `select public.body_save_weigh_in('${elena}', '654321', '${OLD_ROW}', '2026-09-02', null, 70, null)`,
      ),
    ).toMatch(/body_forbidden/);
    // Resetting another profile's PIN needs the current PIN.
    const reset = await asUser(DEVICE_A, () =>
      db.query<{ r: string }>(`select public.body_set_pin('${ariel}', '111111', '654321') as r`),
    );
    expect(reset.rows[0].r).toBe("invalid");
  });

  it("weight is required, body fat optional; delete is scoped to the owner", async () => {
    expect(await unlock(elena, "654321")).toBe("ok");
    expect(await unlock(ariel, "123456")).toBe("ok");
    expect(
      await fails(
        `select public.body_save_weigh_in('${elena}', '654321', null, '2026-09-03', '07:30', null, null)`,
      ),
    ).toMatch(/null value|not-null/);
    const saved = await asUser(DEVICE_A, () =>
      db.query<{ id: string }>(
        `select public.body_save_weigh_in('${elena}', '654321', null, '2026-09-03', '07:30', 61.2, null) as id`,
      ),
    );
    const id = saved.rows[0].id;
    await asUser(DEVICE_A, () =>
      db.query(`select public.body_delete_weigh_in('${ariel}', '123456', '${id}')`),
    );
    const still = await db.query(`select 1 from public.weigh_ins where id = '${id}'`);
    expect(still.rows).toHaveLength(1);
  });

  it("a wrong PIN at a DATA rpc still counts: the throttle cannot be bypassed", async () => {
    // Regression. body_require_pin raises, and a raise rolls back any counter
    // written on the way, so ten wrong PINs through body_list_weigh_ins used to
    // leave failed_attempts at 0 — an unlimited brute force of a 6-digit PIN.
    // A data RPC now needs the capability that only the throttled body_unlock
    // can grant, so guessing has to go through the counted path.
    await asUser(DEVICE_A, () => db.query(`select public.body_set_pin('${ariel}', '123456')`));
    expect(await unlock(ariel, "123456")).toBe("ok");
    for (let i = 0; i < 10; i++) {
      expect(
        await fails(`select * from public.body_list_weigh_ins('${ariel}', '000000')`),
      ).toMatch(/body_pin_invalid/);
    }
    // Guessing through the only throttled entrance does lock, and the lock then
    // also closes the data path.
    for (let i = 0; i < 5; i++) expect(await unlock(ariel, "000000")).toBe("invalid");
    expect(await unlock(ariel, "123456")).toBe("locked");
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '123456')`)).toMatch(
      /body_pin_locked/,
    );
    // Clear the lock for the tests that follow.
    await db.query(
      `update public.body_privacy set failed_attempts = 0, locked_until = null where profile_id = '${ariel}'`,
    );
  });

  it("an expired or explicitly closed window locks the area again", async () => {
    expect(await unlock(ariel, "123456")).toBe("ok");
    await asUser(DEVICE_A, () => db.query(`select public.body_lock('${ariel}')`));
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '123456')`)).toMatch(
      /body_pin_locked/,
    );
    expect(await unlock(ariel, "123456")).toBe("ok");
    await db.query(
      `update public.body_privacy set unlocked_until = now() - interval '1 second' where profile_id = '${ariel}'`,
    );
    expect(await fails(`select * from public.body_list_weigh_ins('${ariel}', '123456')`)).toMatch(
      /body_pin_locked/,
    );
    // One profile's window never opens the other's.
    expect(await unlock(ariel, "123456")).toBe("ok");
    await asUser(DEVICE_A, () => db.query(`select public.body_lock('${elena}')`));
    expect(await fails(`select * from public.body_list_weigh_ins('${elena}', '654321')`)).toMatch(
      /body_pin_locked/,
    );
  });

  it("body_lock and the window helper keep their grants", async () => {
    expect(await fails("select public.body_unlock_window()")).toMatch(/permission denied/);
    expect(await fails(`select public.body_lock('${ariel}')`, STRANGER)).toMatch(
      /body_forbidden/,
    );
  });

  it("five wrong unlocks lock the area; another household is forbidden", async () => {
    for (let i = 0; i < 5; i++) {
      await asUser(DEVICE_A, () => db.query(`select public.body_unlock('${elena}', '999999')`));
    }
    const s = await asUser(DEVICE_A, () =>
      db.query<{ s: string }>(`select public.body_unlock('${elena}', '654321') as s`),
    );
    expect(s.rows[0].s).toBe("locked");
    expect(await fails(`select public.body_pin_status('${ariel}')`, STRANGER)).toMatch(
      /body_forbidden/,
    );
  });
});

describe("DEC-038 calculated products", () => {
  it("household members can create one; another household cannot see it", async () => {
    await asUser(DEVICE_A, () =>
      db.query(
        `insert into public.calculated_products
           (household_id, name, normalized_name, total_points, total_weight_g, points_per_gram)
         values ('${household}', 'מרק עוף', 'מרק עוף', 52, 2000, 0.026)`,
      ),
    );
    const mine = await asUser(DEVICE_A, () =>
      db.query("select name from public.calculated_products"),
    );
    expect(mine.rows).toHaveLength(1);
    const theirs = await asUser(STRANGER, () =>
      db.query("select name from public.calculated_products"),
    );
    expect(theirs.rows).toHaveLength(0);
    expect(
      await fails(
        `insert into public.calculated_products
           (household_id, name, normalized_name, total_points, total_weight_g, points_per_gram)
         values ('${household}', 'x', 'x', 1, 0, 0)`,
      ),
    ).toMatch(/check constraint/);
  });

  it("an archived product frees its name; two active ones cannot share it", async () => {
    await asUser(DEVICE_A, () =>
      db.query(
        `insert into public.calculated_products
           (household_id, name, normalized_name, total_points, total_weight_g, points_per_gram)
         values ('${household}', 'מרק ירקות', 'מרק ירקות', 20, 1000, 0.02)`,
      ),
    );
    expect(
      await fails(
        `insert into public.calculated_products
           (household_id, name, normalized_name, total_points, total_weight_g, points_per_gram)
         values ('${household}', 'מרק ירקות', 'מרק ירקות', 21, 1000, 0.021)`,
      ),
    ).toMatch(/calculated_products_active_name_idx|duplicate key/);
    await asUser(DEVICE_A, () =>
      db.query(
        `update public.calculated_products set is_active = false where normalized_name = 'מרק ירקות'`,
      ),
    );
    // The archived row still exists, so old history can still explain itself.
    const archived = await asUser(DEVICE_A, () =>
      db.query("select 1 from public.calculated_products where normalized_name = 'מרק ירקות'"),
    );
    expect(archived.rows).toHaveLength(1);
    await asUser(DEVICE_A, () =>
      db.query(
        `insert into public.calculated_products
           (household_id, name, normalized_name, total_points, total_weight_g, points_per_gram)
         values ('${household}', 'מרק ירקות', 'מרק ירקות', 21, 1000, 0.021)`,
      ),
    );
    const rows = await asUser(DEVICE_A, () =>
      db.query("select is_active from public.calculated_products where normalized_name = 'מרק ירקות'"),
    );
    expect(rows.rows).toHaveLength(2);
  });

  it("food_entries gains nullable provenance columns", async () => {
    const cols = await db.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
       where table_name = 'food_entries'
         and column_name in ('calculated_product_id','calculated_revision','basis_snapshot')
       order by column_name`,
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual([
      "basis_snapshot",
      "calculated_product_id",
      "calculated_revision",
    ]);
    expect(cols.rows.every((c) => c.is_nullable === "YES")).toBe(true);
  });
});
