// @vitest-environment node
/**
 * Deterministic Postgres test of the household-join semantics (DEC-031) using
 * the REAL migration SQL inside an in-process Postgres (PGlite, no Docker, no
 * network). Supabase's `auth` schema is replaced by a two-line stub (a users
 * table and `auth.uid()` reading the JWT claims setting) and the three API
 * roles exist so RLS is exercised for real: every "device" below runs as the
 * `authenticated` role with its own `sub`, exactly like an anonymous Supabase
 * session.
 *
 * Not covered here (single connection): the advisory lock that serialises two
 * simultaneous first joins. Realtime and token handling are covered by the
 * hermetic cloud-path suite and the gated live suites.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
// The realtime publication and the July data cleanup/seed are not part of the
// join semantics and need Supabase-only objects; every schema/RLS/grant/RPC
// migration is loaded verbatim, in ledger order.
const SKIP = new Set([
  "20260723090300_realtime.sql",
  "20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
]);

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DEVICE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHARED_ACCOUNT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const STRANGER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DEVICE_A_AGAIN = "ffffffff-ffff-4fff-8fff-ffffffffffff";

let db: PGlite;

/** Runs `fn` as an authenticated (anonymous) Supabase session for `sub`. */
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

async function bootstrap(sub: string): Promise<string> {
  return asUser(sub, async () => {
    const r = await db.query<{ hid: string }>("select public.bootstrap_household() as hid");
    return r.rows[0].hid;
  });
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
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (SKIP.has(file)) continue;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("bootstrap_household — one shared household for every device (DEC-031)", () => {
  let household: string;

  it("the first device ever creates the household with exactly two profiles", async () => {
    household = await bootstrap(DEVICE_A);
    expect(household).toMatch(/^[0-9a-f-]{36}$/);
    expect(await count("select count(*) as n from public.households")).toBe(1);
    const profiles = await db.query<{ slug: string; display_name: string }>(
      "select slug, display_name from public.profiles order by sort_order",
    );
    expect(profiles.rows).toEqual([
      { slug: "ariel", display_name: "אריאל" },
      { slug: "alena", display_name: "אלנה" },
    ]);
    const m = await db.query<{ role: string }>(
      `select role from public.household_users where user_id = '${DEVICE_A}'`,
    );
    expect(m.rows).toEqual([{ role: "owner" }]);
  });

  it("a second device joins the SAME household — no new household, no new profiles", async () => {
    expect(await bootstrap(DEVICE_B)).toBe(household);
    expect(await count("select count(*) as n from public.households")).toBe(1);
    expect(await count("select count(*) as n from public.profiles")).toBe(2);
    const m = await db.query<{ role: string }>(
      `select role from public.household_users where user_id = '${DEVICE_B}'`,
    );
    expect(m.rows).toEqual([{ role: "member" }]);
  });

  it("repeat opens are idempotent: nothing is created", async () => {
    const before = await count(
      "select (select count(*) from public.households) + (select count(*) from public.profiles) + (select count(*) from public.household_users) as n",
    );
    expect(await bootstrap(DEVICE_B)).toBe(household);
    expect(await bootstrap(DEVICE_A)).toBe(household);
    const after = await count(
      "select (select count(*) from public.households) + (select count(*) from public.profiles) + (select count(*) from public.household_users) as n",
    );
    expect(after).toBe(before);
  });

  it("a third fresh session and the historical shared account also join the same household", async () => {
    expect(await bootstrap(DEVICE_C)).toBe(household);
    expect(await bootstrap(SHARED_ACCOUNT)).toBe(household);
    expect(await count("select count(*) as n from public.households")).toBe(1);
    expect(await count("select count(*) as n from public.household_users")).toBe(4);
  });

  it("Ariel data stays Ariel and Elena data stays Elena across devices (shared, attributed, RLS on)", async () => {
    const ids = await db.query<{ slug: string; id: string }>(
      "select slug, id from public.profiles",
    );
    const ariel = ids.rows.find((p) => p.slug === "ariel")!.id;
    const alena = ids.rows.find((p) => p.slug === "alena")!.id;
    const entry = (profile: string, name: string) =>
      `insert into public.food_entries (household_id, profile_id, log_date, slot, food_name, quantity_mode, amount, unit)
       values ('${household}', '${profile}', '2026-09-18', 'dinner', '${name}', 'measured', 1, 'יחידה')`;

    await asUser(DEVICE_A, () => db.exec(entry(ariel, "תפוח")));
    await asUser(DEVICE_B, () => db.exec(entry(alena, "בננה")));

    // Device B (Elena's phone) sees both — the shared truth — with the right owners.
    const seenByB = await asUser(DEVICE_B, () =>
      db.query<{ food_name: string; profile_id: string }>(
        "select food_name, profile_id from public.food_entries order by food_name",
      ),
    );
    expect(seenByB.rows).toEqual([
      { food_name: "בננה", profile_id: alena },
      { food_name: "תפוח", profile_id: ariel },
    ]);
    // Device B may edit Elena's row only where the app says so — and the row keeps its owner.
    await asUser(DEVICE_B, () =>
      db.exec(`update public.food_entries set amount = 2 where food_name = 'בננה'`),
    );
    const owners = await db.query<{ food_name: string; profile_id: string; amount: string }>(
      "select food_name, profile_id, amount::text from public.food_entries order by food_name",
    );
    expect(owners.rows).toEqual([
      { food_name: "בננה", profile_id: alena, amount: "2" },
      { food_name: "תפוח", profile_id: ariel, amount: "1" },
    ]);
  });

  it("a session that never joined sees nothing and cannot write (RLS boundary = membership)", async () => {
    const rows = await asUser(STRANGER, () => db.query("select * from public.food_entries"));
    expect(rows.rows).toEqual([]);
    const profiles = await asUser(STRANGER, () => db.query("select * from public.profiles"));
    expect(profiles.rows).toEqual([]);
    await expect(
      asUser(STRANGER, () =>
        db.exec(
          `insert into public.food_entries (household_id, profile_id, log_date, slot, food_name, quantity_mode, amount, unit)
           select '${household}', id, '2026-09-18', 'dinner', 'x', 'measured', 1, 'יחידה' from public.profiles limit 1`,
        ),
      ),
    ).resolves.toBeDefined(); // insert ... select over 0 visible profiles inserts nothing
    expect(await count("select count(*) as n from public.food_entries where food_name = 'x'")).toBe(
      0,
    );
    await expect(
      asUser(STRANGER, () =>
        db.exec(
          `insert into public.food_entries (household_id, profile_id, log_date, slot, food_name, quantity_mode, amount, unit)
           values ('${household}', (select id from public.profiles limit 1), '2026-09-18', 'dinner', 'x', 'measured', 1, 'יחידה')`,
        ),
      ),
    ).rejects.toThrow(); // profile_id null (invisible) / RLS with-check
  });

  it("the unauthenticated anon role can neither join nor read", async () => {
    await db.exec(`select set_config('request.jwt.claims', '', false); set role anon;`);
    try {
      await expect(db.query("select public.bootstrap_household()")).rejects.toThrow(
        /permission denied|not authenticated/,
      );
      // anon holds no table privilege at all (grants migration): denied before RLS.
      await expect(db.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("session loss: a fresh device identity re-joins the same household and every cloud row is still there", async () => {
    // Device A's browser storage was cleared → a new anonymous user id.
    expect(await bootstrap(DEVICE_A_AGAIN)).toBe(household);
    expect(await count("select count(*) as n from public.households")).toBe(1);
    const rows = await asUser(DEVICE_A_AGAIN, () =>
      db.query<{ food_name: string }>(
        "select food_name from public.food_entries order by food_name",
      ),
    );
    expect(rows.rows.map((r) => r.food_name)).toEqual(["בננה", "תפוח"]);
  });
});
