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
import { join, join as join_ } from "node:path";
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
    create publication supabase_realtime;
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

/**
 * Production-shaped history: the July 2026 household (seeded catalog, two
 * profiles, the permanent shared account as owner) already exists, and a
 * stray newer household exists too (e.g. created by a sign-in under the old
 * per-user bootstrap). Every new device must land in the historical one.
 */
describe("bootstrap_household — historical household wins, catalog stays attached, 20 joins", () => {
  let db2: PGlite;
  const OLD = "10000000-0000-4000-8000-000000000001";
  const NEWER = "20000000-0000-4000-8000-000000000002";
  const PERMANENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  async function asUser2<T>(sub: string | null, fn: () => Promise<T>): Promise<T> {
    if (sub) await db2.exec(`insert into auth.users (id) values ('${sub}') on conflict do nothing`);
    const claims = sub ? JSON.stringify({ sub, role: "authenticated", is_anonymous: true }) : "";
    await db2.exec(
      `select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`,
    );
    try {
      return await fn();
    } finally {
      await db2.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
    }
  }
  const join = (sub: string | null) =>
    asUser2(sub, async () => {
      const r = await db2.query<{ hid: string }>("select public.bootstrap_household() as hid");
      return r.rows[0].hid;
    });
  const n = async (sql: string) => Number((await db2.query<{ n: string | number }>(sql)).rows[0].n);

  beforeAll(async () => {
    db2 = new PGlite({ extensions: { pgcrypto } });
    await db2.exec(`
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
      await db2.exec(readFileSync(join_(MIGRATIONS, file), "utf8"));
    }
    // History: the July household (older) with the permanent account, two
    // profiles and a catalog; then a stray newer household.
    await db2.exec(`
      insert into auth.users (id) values ('${PERMANENT}');
      insert into public.households (id, name, created_at) values ('${OLD}', 'משק בית', '2026-07-25T10:00:00Z');
      insert into public.household_users (household_id, user_id, role) values ('${OLD}', '${PERMANENT}', 'owner');
      insert into public.profiles (household_id, display_name, slug, sort_order)
        values ('${OLD}', 'אריאל', 'ariel', 1), ('${OLD}', 'אלנה', 'alena', 2);
      insert into public.foods (household_id, name, normalized_name, default_unit)
        values ('${OLD}', 'ביצה קשה', 'ביצה קשה', 'יחידה'), ('${OLD}', 'קוטג׳', 'קוטג׳', 'גרם');
      insert into public.households (id, name, created_at) values ('${NEWER}', 'stray', '2026-09-18T12:00:00Z');
    `);
  }, 60_000);

  afterAll(async () => {
    await db2?.close();
  });

  it("a caller without a JWT subject cannot bootstrap", async () => {
    await expect(join(null)).rejects.toThrow(/not authenticated/);
    expect(await n("select count(*) as n from public.households")).toBe(2);
  });

  it("20 first-time device identities all join the historical household; nothing new is created", async () => {
    const slugsBefore = (
      await db2.query<{ slug: string }>(
        `select slug from public.profiles where household_id = '${OLD}' order by sort_order`,
      )
    ).rows.map((r) => r.slug);
    const ids = Array.from(
      { length: 20 },
      (_, i) => `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    );
    // PGlite is one Postgres session: joins run back-to-back, which is exactly
    // the order pg_advisory_xact_lock imposes on truly concurrent first joins.
    const results: string[] = [];
    for (const id of ids) results.push(await join(id));
    expect(new Set(results)).toEqual(new Set([OLD]));
    expect(await n("select count(*) as n from public.households")).toBe(2); // OLD + the pre-existing stray
    expect(
      await n(`select count(*) as n from public.household_users where household_id = '${OLD}'`),
    ).toBe(21);
    expect(
      await n(`select count(*) as n from public.household_users where household_id = '${NEWER}'`),
    ).toBe(0);
    // Profiles: still exactly two, same slugs, same rows.
    expect(await n(`select count(*) as n from public.profiles where household_id = '${OLD}'`)).toBe(
      2,
    );
    expect(await n("select count(*) as n from public.profiles")).toBe(2);
    const slugsAfter = (
      await db2.query<{ slug: string }>(
        `select slug from public.profiles where household_id = '${OLD}' order by sort_order`,
      )
    ).rows.map((r) => r.slug);
    expect(slugsAfter).toEqual(slugsBefore);
    expect(slugsAfter).toEqual(["ariel", "alena"]);
    // Repeated bootstraps: idempotent.
    for (const id of ids.slice(0, 5)) expect(await join(id)).toBe(OLD);
    expect(
      await n(`select count(*) as n from public.household_users where household_id = '${OLD}'`),
    ).toBe(21);
  });

  it("the permanent account keeps its access and still resolves to the same household", async () => {
    expect(await join(PERMANENT)).toBe(OLD);
    const role = await db2.query<{ role: string }>(
      `select role from public.household_users where user_id = '${PERMANENT}'`,
    );
    expect(role.rows).toEqual([{ role: "owner" }]);
  });

  it("the catalog stays attached: a device that joined later sees the household's foods", async () => {
    const foods = await asUser2("a0000000-0000-4000-8000-000000000020", () =>
      db2.query<{ name: string; household_id: string }>(
        "select name, household_id from public.foods order by name",
      ),
    );
    expect(foods.rows.map((f) => f.household_id)).toEqual([OLD, OLD]);
    expect(foods.rows.map((f) => f.name)).toEqual(["ביצה קשה", "קוטג׳"]);
  });

  it("before bootstrap a session sees no household row; right after, only the joined household", async () => {
    const fresh = "b0000000-0000-4000-8000-000000000001";
    const before = await asUser2(fresh, () =>
      db2.query("select id from public.households union all select id from public.profiles"),
    );
    expect(before.rows).toEqual([]);
    expect(await join(fresh)).toBe(OLD);
    const after = await asUser2(fresh, () =>
      db2.query<{ id: string }>("select id from public.households order by created_at"),
    );
    expect(after.rows).toEqual([{ id: OLD }]); // the stray newer household stays invisible
    const memberships = await asUser2(fresh, () =>
      db2.query<{ user_id: string }>("select user_id from public.household_users"),
    );
    // household_users_select: own row or any member's row of the joined household.
    expect(memberships.rows.some((m) => m.user_id === fresh)).toBe(true);
    expect(memberships.rows.some((m) => m.user_id === PERMANENT)).toBe(true);
  });
});

describe("hardening migration 20260918180000 (search_path + execute grants)", () => {
  it("set_updated_at is pinned, still bumps updated_at; anon lost execute on the membership helper, authenticated kept it", async () => {
    const def = await db.query<{ def: string }>(
      "select pg_get_functiondef('public.set_updated_at()'::regprocedure) as def",
    );
    expect(def.rows[0].def).toMatch(/SET search_path TO ''/);
    // Trigger behaviour unchanged: an UPDATE moves updated_at forward.
    const before = await db.query<{ id: string; updated_at: string }>(
      "select id, updated_at from public.food_entries order by food_name limit 1",
    );
    await db.exec("select pg_sleep(0.01)");
    await asUser(DEVICE_A, () =>
      db.exec(
        `update public.food_entries set amount = amount + 1 where id = '${before.rows[0].id}'`,
      ),
    );
    const after = await db.query<{ updated_at: string }>(
      `select updated_at from public.food_entries where id = '${before.rows[0].id}'`,
    );
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0].updated_at).getTime(),
    );
    const grants = await db.query<{ r: string; ok: boolean }>(
      `select r, has_function_privilege(r, 'public.is_household_member(uuid)', 'execute') as ok
       from unnest(array['anon','authenticated','service_role']) as r`,
    );
    expect(Object.fromEntries(grants.rows.map((g) => [g.r, g.ok]))).toEqual({
      anon: false,
      authenticated: true,
      service_role: true,
    });
    // Policies still work for members after the revoke.
    const rows = await asUser(DEVICE_B, () => db.query("select id from public.food_entries"));
    expect(rows.rows.length).toBeGreaterThan(0);
  });
});

describe("migration 20260919100000 — points v2-il profile facts", () => {
  it("adds the nullable facts with checks; a non-default v1 budget carries over as the override once, 30 does not", async () => {
    const cols = await db.query<{
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select column_name, is_nullable, column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('sex_at_birth','birth_date','height_cm','goal_mode','points_budget_override','daily_points_budget')
       order by column_name`,
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual([
      "birth_date",
      "daily_points_budget",
      "goal_mode",
      "height_cm",
      "points_budget_override",
      "sex_at_birth",
    ]);
    expect(cols.rows.find((c) => c.column_name === "goal_mode")!.column_default).toContain("lose");
    // Existing profiles stay valid with null facts.
    const nulls = await db.query<{ n: string }>(
      "select count(*) as n from public.profiles where sex_at_birth is null and birth_date is null and height_cm is null and points_budget_override is null",
    );
    expect(Number(nulls.rows[0].n)).toBe(2);
    // Constraints reject nonsense.
    await expect(
      db.exec("update public.profiles set sex_at_birth = 'x' where slug = 'ariel'"),
    ).rejects.toThrow();
    await expect(
      db.exec("update public.profiles set height_cm = 10 where slug = 'ariel'"),
    ).rejects.toThrow();
    await expect(
      db.exec("update public.profiles set goal_mode = 'bulk' where slug = 'ariel'"),
    ).rejects.toThrow();
    await expect(
      db.exec("update public.profiles set points_budget_override = 5 where slug = 'ariel'"),
    ).rejects.toThrow();
    // Carry-over rule (idempotent re-run of the migration statement).
    await db.exec("update public.profiles set daily_points_budget = 27 where slug = 'ariel'");
    await db.exec("update public.profiles set daily_points_budget = 30 where slug = 'alena'");
    await db.exec(
      readFileSync(join(MIGRATIONS, "20260919100000_points_v2_profile_facts.sql"), "utf8"),
    );
    const after = await db.query<{ slug: string; points_budget_override: number | null }>(
      "select slug, points_budget_override from public.profiles order by sort_order",
    );
    expect(after.rows).toEqual([
      { slug: "ariel", points_budget_override: 27 },
      { slug: "alena", points_budget_override: null },
    ]);
    // A member (authenticated) can update their household's profile facts; a stranger cannot.
    await asUser(DEVICE_A, () =>
      db.exec(
        "update public.profiles set sex_at_birth = 'male', height_cm = 178 where slug = 'ariel'",
      ),
    );
    const upd = await asUser(STRANGER, () =>
      db.query("update public.profiles set height_cm = 100 where slug = 'ariel' returning id"),
    );
    expect(upd.rows).toEqual([]);
    const ariel = await db.query<{ height_cm: string }>(
      "select height_cm from public.profiles where slug = 'ariel'",
    );
    expect(Number(ariel.rows[0].height_cm)).toBe(178);
  });
});
