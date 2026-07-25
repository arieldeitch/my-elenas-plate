/**
 * Pure helpers that turn the TypeScript catalog into the seed SQL block.
 *
 * Side-effect free on purpose: `src/lib/catalog-seed.test.ts` imports this to
 * assert the checked-in migration is the current generated form, while
 * `generate-catalog-seed.ts` is the entry point that actually writes the file.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BUILT_IN_FOODS } from "../src/lib/food-catalog.ts";
import { normalizeFoodName } from "../src/lib/food-normalize.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export const MIGRATION_PATH = resolve(
  HERE,
  "../supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql",
);
export const BOOTSTRAP_PATH = resolve(HERE, "../supabase/bootstrap_and_seed.sql");
export const BEGIN_MARKER = "-- >>> BEGIN GENERATED CATALOG SEED";
export const END_MARKER = "-- <<< END GENERATED CATALOG SEED";

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** The catalog as a `values` list — shared by the migration and the bootstrap file. */
function catalogValues(): string {
  return BUILT_IN_FOODS.map((food) => {
    const cells = [
      q(food.name),
      q(normalizeFoodName(food.name)),
      q(food.category ?? ""),
      q(food.defaultUnit ?? ""),
      q(food.kind ?? "generic"),
    ];
    return `  (${cells.join(", ")})`;
  }).join(",\n");
}

/** Builds the SQL block that seeds every household with the catalog. */
export function buildSeedSql(): string {
  const rows = catalogValues();

  return [
    "with catalog (name, normalized_name, category, default_unit, kind) as (values",
    rows,
    "),",
    "upserted as (",
    "  insert into public.foods (household_id, name, normalized_name, category, default_unit, kind, is_active)",
    "  select h.id, c.name, c.normalized_name, c.category, c.default_unit, c.kind, true",
    "  from public.households h",
    "  cross join catalog c",
    "  on conflict (household_id, normalized_name) do update",
    "    set name = excluded.name,",
    "        category = excluded.category,",
    "        default_unit = excluded.default_unit,",
    "        kind = excluded.kind",
    "  -- is_active is deliberately NOT reset: if a household archived a food,",
    "  -- re-running the seed must not resurrect it.",
    "  returning (xmax::text::bigint = 0) as inserted",
    ")",
    "insert into catalog_migration_report (step, detail, count)",
    "select '7_seed', case when inserted then 'foods_inserted' else 'foods_updated' end, count(*)",
    "from upserted",
    "group by inserted;",
    "",
    "insert into catalog_migration_report (step, detail, count)",
    "values",
    `  ('7_seed', 'catalog_items_defined', ${BUILT_IN_FOODS.length}),`,
    "  ('7_seed', 'households_seeded', (select count(*) from public.households));",
  ].join("\n");
}

/** Splices a freshly built seed block into the migration file's markers. */
export function spliceSeed(sql: string, seed: string): string {
  const begin = sql.indexOf(BEGIN_MARKER);
  const end = sql.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`generated-seed markers missing or out of order in ${MIGRATION_PATH}`);
  }
  return `${sql.slice(0, begin + BEGIN_MARKER.length)}\n${seed}\n${sql.slice(end)}`;
}

/** Extracts the generated block from a migration file (used by the parity test). */
export function extractSeed(sql: string): string {
  const begin = sql.indexOf(BEGIN_MARKER);
  const end = sql.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) throw new Error("generated-seed markers missing");
  return sql.slice(begin + BEGIN_MARKER.length, end).trim();
}

/**
 * Builds the standalone bootstrap + seed script.
 *
 * Needed because the catalog seed inserts one row per household
 * (`from public.households h cross join catalog c`), so on a project where no
 * account has ever signed in there are 0 households and the seed inserts 0 rows.
 * `bootstrap_household()` normally creates the household on first sign-in; this
 * script does the same thing from the SQL Editor, then seeds.
 *
 * Safety rules encoded here:
 *  - `auth.users` is READ ONLY (id + email), never inserted, updated or deleted.
 *  - A household/profiles are created only when a real account already exists, so
 *    a later `bootstrap_household()` call finds the membership and returns this
 *    household instead of creating a second one.
 *  - Test-suite accounts (the generated `e2e_/t_/live_` email shape) are excluded
 *    from membership, so a leftover test account never gains access.
 *  - An existing household is reused, never replaced. Everything is idempotent.
 *  - No RLS or policy statement, no DDL, no DELETE of user data.
 */
export function buildBootstrapSql(): string {
  const testEmail = "^(e2e|t|live)_[0-9]{13}_[0-9]+@";
  const realUser = `u.email is not null and u.email !~ '${testEmail}'`;

  return `-- ============================================================================
-- Bootstrap + food catalog seed — run once in the Supabase SQL Editor.
--
-- WHY THIS EXISTS
--   The catalog is stored per household (public.foods.household_id). The seed in
--   20260725190000_cleanup_mock_data_and_seed_food_catalog.sql inserts one row per
--   household, so on a project with 0 households it correctly inserts 0 rows.
--   That is what happened: the schema is present but no household exists yet,
--   because public.bootstrap_household() only runs when an account signs in.
--
-- WHAT THIS DOES
--   1. Reports what is currently in the database.
--   2. Ensures one household, its membership, and the two profiles
--      (אריאל / אלנה) — exactly what bootstrap_household() would create, and only
--      when a real account already exists.
--   3. Upserts the ${BUILT_IN_FOODS.length}-item Hebrew catalog for every household.
--   4. Returns verification counts, ending with a single readable status row.
--
-- WHAT IT NEVER TOUCHES
--   auth.users (read only — id and email, for membership and to exclude test
--   accounts), RLS, any policy, any table structure. No DELETE of user data, no
--   TRUNCATE. Safe to run again: every step is idempotent.
--
-- Generated from src/data/foods/*.ts by \`npm run catalog:seed\` — do not edit by
-- hand; edit the TypeScript modules and regenerate.
-- ============================================================================

create temporary table if not exists bootstrap_report (
  step text not null,
  detail text not null,
  count bigint not null,
  note text
);
delete from bootstrap_report;

-- ---------------------------------------------------------------------------
-- §0  Before
-- ---------------------------------------------------------------------------
insert into bootstrap_report (step, detail, count, note)
values
  ('0_before', 'auth_accounts', (select count(*) from auth.users), 'read only'),
  ('0_before', 'households', (select count(*) from public.households), null),
  ('0_before', 'profiles', (select count(*) from public.profiles), null),
  ('0_before', 'household_memberships', (select count(*) from public.household_users), null),
  ('0_before', 'foods', (select count(*) from public.foods), null),
  ('0_before', 'food_entries', (select count(*) from public.food_entries), null),
  ('0_before', 'meal_statuses', (select count(*) from public.meal_statuses), null),
  ('0_before', 'fasting_logs', (select count(*) from public.fasting_logs), null),
  ('0_before', 'workout_logs', (select count(*) from public.workout_logs), null),
  ('0_before', 'weigh_ins', (select count(*) from public.weigh_ins), null),
  ('0_before', 'food_preferences', (select count(*) from public.food_preferences), null);

-- ---------------------------------------------------------------------------
-- §1  Household + membership + the two profiles
--
-- Mirrors public.bootstrap_household(). Creates nothing unless a real account
-- exists, because a household with no member would be invisible to the app under
-- RLS and would make the next sign-in create a second household.
-- ---------------------------------------------------------------------------
do $bootstrap$
declare
  hid uuid;
  real_accounts integer;
  made_household boolean := false;
  added_members integer := 0;
  added_profiles integer := 0;
begin
  select count(*) into real_accounts
  from auth.users u
  where ${realUser};

  insert into bootstrap_report (step, detail, count, note)
  values ('1_bootstrap', 'real_accounts_found', real_accounts,
          case when real_accounts = 0
               then 'no account has signed in yet — nothing created (see status row)'
               else 'ok' end);

  if real_accounts = 0 then
    return;
  end if;

  select id into hid from public.households order by created_at, id limit 1;
  if hid is null then
    insert into public.households (name) values ('משק בית') returning id into hid;
    made_household := true;
  end if;

  insert into public.household_users (household_id, user_id, role)
  select hid, u.id, 'owner'
  from auth.users u
  where ${realUser}
  on conflict (household_id, user_id) do nothing;
  get diagnostics added_members = row_count;

  insert into public.profiles (household_id, display_name, slug, sort_order)
  values (hid, 'אריאל', 'ariel', 1), (hid, 'אלנה', 'alena', 2)
  on conflict (household_id, slug) do nothing;
  get diagnostics added_profiles = row_count;

  insert into bootstrap_report (step, detail, count, note)
  values
    ('1_bootstrap', 'household_created', case when made_household then 1 else 0 end,
     case when made_household then 'new household' else 'reused the existing household' end),
    ('1_bootstrap', 'memberships_added', added_members, 'test-suite accounts excluded'),
    ('1_bootstrap', 'profiles_added', added_profiles, 'אריאל / אלנה');
end
$bootstrap$;

-- ---------------------------------------------------------------------------
-- §2  Catalog seed (idempotent upsert on the existing unique constraint)
-- ---------------------------------------------------------------------------
with catalog (name, normalized_name, category, default_unit, kind) as (values
${catalogValues()}
),
upserted as (
  insert into public.foods (household_id, name, normalized_name, category, default_unit, kind, is_active)
  select h.id, c.name, c.normalized_name, c.category, c.default_unit, c.kind, true
  from public.households h
  cross join catalog c
  on conflict (household_id, normalized_name) do update
    set name = excluded.name,
        category = excluded.category,
        default_unit = excluded.default_unit,
        kind = excluded.kind
  returning (xmax::text::bigint = 0) as inserted
)
insert into bootstrap_report (step, detail, count, note)
select '2_seed', case when inserted then 'foods_inserted' else 'foods_updated' end, count(*), null
from upserted
group by inserted;

insert into bootstrap_report (step, detail, count, note)
values ('2_seed', 'catalog_items_defined', ${BUILT_IN_FOODS.length}, 'per household');

-- ---------------------------------------------------------------------------
-- §3  Verification (counts only — no names, weights or dates)
-- ---------------------------------------------------------------------------
insert into bootstrap_report (step, detail, count, note)
values
  ('3_after', 'households', (select count(*) from public.households), null),
  ('3_after', 'profiles_ariel_alena',
    (select count(*) from public.profiles where slug in ('ariel', 'alena')), 'expected 2'),
  ('3_after', 'household_memberships', (select count(*) from public.household_users), null),
  ('3_after', 'foods_active', (select count(*) from public.foods where is_active), 'expected ${BUILT_IN_FOODS.length}'),
  ('3_after', 'foods_duplicate_normalized_names', (
    select coalesce(sum(c - 1), 0) from (
      select count(*) as c from public.foods group by household_id, normalized_name having count(*) > 1
    ) d
  ), 'expected 0'),
  ('3_after', 'meal_slots_defined', (
    select count(*) from (
      values ('opening_window'), ('first_snack'), ('main_meal'),
             ('afternoon_snack'), ('dinner'), ('extra_meal')
    ) s(slot)
    where exists (
      select 1 from pg_constraint c
      where c.conname = 'meal_statuses_slot_check'
        and pg_get_constraintdef(c.oid) like '%' || s.slot || '%'
    )
  ), 'expected 6'),
  ('3_after', 'tables_with_rls', (
    select count(*) from pg_tables t
    where t.schemaname = 'public'
      and t.rowsecurity
      and t.tablename in (
        'households', 'household_users', 'profiles', 'foods', 'food_preferences',
        'meal_statuses', 'food_entries', 'fasting_logs', 'workout_logs', 'weigh_ins'
      )
  ), 'expected 10'),
  ('3_after', 'food_entries', (select count(*) from public.food_entries), 'expected 0 before real logging'),
  ('3_after', 'weigh_ins', (select count(*) from public.weigh_ins), 'expected 0 before real logging'),
  ('3_after', 'food_preferences', (select count(*) from public.food_preferences), 'expected 0 until a food is used');

insert into bootstrap_report (step, detail, count, note)
select '9_status', 'result', (select count(*) from public.foods where is_active),
  case
    when (select count(*) from public.households) = 0
      then 'SIGN IN TO THE APP FIRST, THEN RUN THIS AGAIN'
    when (select count(*) from public.foods where is_active) >= ${BUILT_IN_FOODS.length}
      and (select count(*) from public.profiles where slug in ('ariel', 'alena')) = 2
      then 'READY'
    else 'INCOMPLETE — review the counts above'
  end;

select step, detail, count, coalesce(note, '') as note
from bootstrap_report
order by step, detail;
`;
}

export { BUILT_IN_FOODS };
