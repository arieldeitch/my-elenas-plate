-- ============================================================================
-- Cleanup of demonstrably-mocked records + idempotent seed of the Hebrew food
-- catalog.  Forward-only.  Safe to inspect; safe to re-run (see §Idempotency).
--
-- PURPOSE
--   The pilot project accumulated three kinds of non-real rows during
--   development: households created by the automated test suites, the
--   localStorage demo seed that was imported into a real account, and one
--   explicit E2E fixture food.  Real daily logging starts 2026-07-26, so this
--   migration removes those rows and populates `public.foods` with the
--   production catalog for every existing household.
--
-- WHAT IS PRESERVED (nothing here is touched)
--   * auth.users                — never read for anything but pattern matching,
--                                 never modified or deleted.
--   * households / household_users / profiles of real accounts.
--   * The six meal slots        — they are a CHECK constraint on
--                                 meal_statuses.slot, not data; no DDL here.
--   * RLS + all policies        — no ALTER ... DISABLE ROW LEVEL SECURITY,
--                                 no policy is created, altered or dropped.
--   * Application settings, existing valid migrations.
--   * Every transactional row that is not matched by an explicit fingerprint
--     below.  Ambiguity is always resolved in favour of keeping the row; the
--     report table at the end counts what was left alone.
--
-- HOW MOCK ROWS ARE IDENTIFIED (no rule uses a date or "row is old")
--   1. Test households: every member's auth email matches the generated shape
--      produced by the test helpers — `^(e2e|t|live)_<13-digit ms>_<digits>@`
--      (e2e/helpers.ts uniqueEmail(), rls.integration.test.ts,
--      remote-live.integration.test.ts).  A human address cannot take that
--      shape.  Deleting the household row cascades to its own data only.
--   2. Demo days: the removed src/lib/demo-data.ts built exactly four day
--      shapes.  A day is deleted only when the complete multiset of its entries
--      — slot, food name, quantity mode, amount, unit, subjective — equals one
--      of those four signatures exactly.  One extra or missing entry preserves
--      the whole day.  Value-only matching is deliberately NOT used: e.g.
--      "קפה · 1 · כוס" is also what a real fast-add produces.
--   3. Demo favorites/recents: the importer stamped recency from a fixed epoch
--      (RECENCY_BASE_MS = 1784000000000 in sync/migrate-local.ts), i.e. exact
--      whole-minute instants at to_timestamp(1784000000 - n*60).  Real usage
--      stamps Date.now().  Independently, a profile whose complete set of
--      preference food ids equals the demo union for its slug is a demo import.
--   4. Demo weigh-ins: exact (weight_kg, body_fat_pct) pairs from demo-data.ts
--      AND the profile has no other weigh-in.  If the profile has any weigh-in
--      of its own, nothing is deleted for that profile.
--   5. E2E fixture food: the exact literal name created by crud.spec.ts.
--
-- TABLES AFFECTED
--   deleted from : households (test accounts only, cascades), food_entries,
--                  meal_statuses, fasting_logs, workout_logs, weigh_ins,
--                  food_preferences, foods (one fixture row)
--   inserted into: foods (catalog seed, upsert)
--   never touched: auth.*, profiles, household_users, and all policies
--
-- CONSTRAINTS / DDL
--   One additive index only (foods_household_normalized_idx) to keep catalog
--   lookups and the upsert's conflict target fast.  No column, type, constraint
--   or policy change.  No TRUNCATE.  No unconditional DELETE.
--
-- IDEMPOTENCY
--   Cleanup is fingerprint-driven, so a second run matches nothing and deletes
--   0 rows.  The catalog seed is an upsert on the existing
--   unique (household_id, normalized_name) constraint, so re-running updates
--   the same rows in place and never grows the catalog.
--
-- VERIFICATION
--   The final SELECT returns a before/after audit (counts only — no row
--   contents, no health data).  `supabase/verify_catalog.sql` re-runs the same
--   read-only checks at any later time.
--
-- ROLLBACK / REMEDIATION
--   Deletions are not reversible in-place; the rows removed are test-account
--   and demo-seed rows only.  To undo the seed:
--     delete from public.foods where created_by_seed_marker...  -- (not used)
--   the catalog rows carry no marker column by design, so remediation is
--   `delete from public.foods where household_id = '<id>' and normalized_name
--   in (...)`, or simply archiving them: update public.foods set is_active =
--   false where ... .  Historical entries are unaffected either way because
--   food_entries stores the food name, not a foreign key.
-- ============================================================================

-- Audit trail for this run. Temporary: it disappears with the session and can
-- never leak into application data.
create temporary table if not exists catalog_migration_report (
  step text not null,
  detail text not null,
  count bigint not null
);

-- Start from a clean audit even if this script is executed twice in one session.
delete from catalog_migration_report;

-- ---------------------------------------------------------------------------
-- §0  Before counts
-- ---------------------------------------------------------------------------
insert into catalog_migration_report (step, detail, count)
values
  ('0_before', 'households', (select count(*) from public.households)),
  ('0_before', 'profiles', (select count(*) from public.profiles)),
  ('0_before', 'foods', (select count(*) from public.foods)),
  ('0_before', 'foods_active', (select count(*) from public.foods where is_active)),
  ('0_before', 'food_entries', (select count(*) from public.food_entries)),
  ('0_before', 'meal_statuses', (select count(*) from public.meal_statuses)),
  ('0_before', 'fasting_logs', (select count(*) from public.fasting_logs)),
  ('0_before', 'workout_logs', (select count(*) from public.workout_logs)),
  ('0_before', 'weigh_ins', (select count(*) from public.weigh_ins)),
  ('0_before', 'food_preferences', (select count(*) from public.food_preferences));

-- ---------------------------------------------------------------------------
-- §1  Households created by the automated test suites
--
-- A household qualifies only when it has at least one member and EVERY member
-- address matches the generated test shape. A household containing one real
-- member is never touched. auth.users itself is only read.
-- ---------------------------------------------------------------------------
with test_households as (
  select hu.household_id
  from public.household_users hu
  join auth.users u on u.id = hu.user_id
  group by hu.household_id
  having bool_and(u.email ~ '^(e2e|t|live)_[0-9]{13}_[0-9]+@')
),
removed as (
  delete from public.households h
  where h.id in (select household_id from test_households)
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '1_cleanup', 'test_households_deleted (cascades to their own rows)', count(*) from removed;

-- ---------------------------------------------------------------------------
-- §2  Demo days imported from the localStorage demo seed
--
-- `demo_day_signature` holds the four exact day shapes built by the removed
-- src/lib/demo-data.ts (slot slugs as stored by mappers.ts). A day is deleted
-- only if its entry multiset equals one of them exactly.
-- ---------------------------------------------------------------------------
create temporary table if not exists demo_day_matches (
  profile_id uuid not null,
  log_date date not null
);
delete from demo_day_matches;

insert into demo_day_matches (profile_id, log_date)
with entry_signature as (
  select
    fe.profile_id,
    fe.log_date,
    fe.slot
      || '|' || fe.food_name
      || '|' || fe.quantity_mode
      || '|' || coalesce(trim_scale(fe.amount)::text, '')
      || '|' || coalesce(fe.unit, '')
      || '|' || coalesce(fe.subjective, '') as sig
  from public.food_entries fe
),
day_signature as (
  select profile_id, log_date, array_agg(sig order by sig) as sigs
  from entry_signature
  group by profile_id, log_date
),
demo_day_signature (name, sigs) as (
  values
    -- demo-data.ts meDay(): today, profile אריאל
    ('meDay', array[
      'opening_window|חביתה|measured|2|יחידה|',
      'opening_window|סלט ירקות|subjective|||moderate',
      'opening_window|לחם מלא|measured|2|פרוסה|',
      'first_snack|קפה|measured|1|כוס|',
      'main_meal|חזה עוף|measured|180|גרם|',
      'main_meal|אורז|measured|1|כוס|',
      'main_meal|טחינה|measured|1|כף|',
      'afternoon_snack|קפה|measured|1|ספל|'
    ]),
    -- demo-data.ts elenaDay(): today, profile אלנה
    ('elenaDay', array[
      'opening_window|יוגורט|measured|1|יחידה|',
      'opening_window|גרנולה|measured|3|כף|',
      'opening_window|בננה|measured|1|יחידה|',
      'main_meal|סלט ירקות|subjective|||much',
      'main_meal|גבינה לבנה|measured|100|גרם|',
      'afternoon_snack|תפוח|measured|1|יחידה|',
      'afternoon_snack|שקדים|subjective|||little'
    ]),
    -- demo-data.ts fullSampleDay(): one תפוח in five slots, extra_meal skipped
    ('fullSampleDay', array[
      'opening_window|תפוח|measured|1|יחידה|',
      'first_snack|תפוח|measured|1|יחידה|',
      'main_meal|תפוח|measured|1|יחידה|',
      'afternoon_snack|תפוח|measured|1|יחידה|',
      'dinner|תפוח|measured|1|יחידה|'
    ]),
    -- demo-data.ts partialSampleDay()
    ('partialSampleDay', array[
      'opening_window|קפה|measured|1|כוס|',
      'main_meal|סלט ירקות|subjective|||moderate'
    ])
)
select d.profile_id, d.log_date
from day_signature d
join demo_day_signature s
  on (select array_agg(x order by x) from unnest(s.sigs) x) = d.sigs;

insert into catalog_migration_report (step, detail, count)
select '2_cleanup', 'demo_days_matched (profile/day pairs)', count(*) from demo_day_matches;

-- Foreign-key-safe order: child rows (entries) before the day's status row.
-- Neither table references the other, but keeping entries first means a partial
-- failure can never leave a "logged" status with no entries behind it.
with removed as (
  delete from public.food_entries fe
  using demo_day_matches m
  where fe.profile_id = m.profile_id and fe.log_date = m.log_date
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '2_cleanup', 'food_entries_deleted', count(*) from removed;

with removed as (
  delete from public.meal_statuses ms
  using demo_day_matches m
  where ms.profile_id = m.profile_id and ms.log_date = m.log_date
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '2_cleanup', 'meal_statuses_deleted', count(*) from removed;

-- Fasting / workout are deleted only for a day already proven to be a demo day
-- by its entry signature. The demo values alone (20:30→12:30, הליכה/טוב) are
-- plausible real input and are never sufficient on their own.
with removed as (
  delete from public.fasting_logs fl
  using demo_day_matches m
  where fl.profile_id = m.profile_id
    and fl.log_date = m.log_date
    and fl.start_time = '20:30'
    and fl.end_time = '12:30'
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '2_cleanup', 'fasting_logs_deleted', count(*) from removed;

with removed as (
  delete from public.workout_logs wl
  using demo_day_matches m
  where wl.profile_id = m.profile_id
    and wl.log_date = m.log_date
    and (
      (wl.performed is true and wl.workout_type = 'הליכה' and wl.feeling = 'טוב')
      or (wl.performed is null and wl.workout_type is null and wl.feeling is null)
    )
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '2_cleanup', 'workout_logs_deleted', count(*) from removed;

-- ---------------------------------------------------------------------------
-- §3  Demo favorites / recents
--
-- 3a. Deterministic recency epoch — an exact whole-minute instant derived from
--     RECENCY_BASE_MS. Real usage stamps Date.now(); it cannot land here.
-- 3b. A profile whose COMPLETE preference id set equals the demo union for its
--     slug. One id outside the set preserves every row for that profile.
-- ---------------------------------------------------------------------------
with removed as (
  delete from public.food_preferences fp
  where fp.last_used_at in (
    select to_timestamp(1784000000 - g * 60) from generate_series(0, 11) g
  )
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '3_cleanup', 'demo_recents_deleted (fixed-epoch stamp)', count(*) from removed;

with demo_pref_set (slug, food_ids) as (
  values
    ('ariel', array[
      'f_coffee', 'f_omelette', 'f_chicken_breast', 'f_tahini',
      'f_whole_bread', 'f_veg_salad', 'f_rice', 'f_milk'
    ]),
    ('alena', array[
      'f_yogurt', 'f_apple', 'f_veg_salad', 'f_granola',
      'f_banana', 'f_almonds', 'f_white_cheese'
    ])
),
profile_pref_set as (
  select fp.profile_id, p.slug, array_agg(distinct fp.food_id) as food_ids
  from public.food_preferences fp
  join public.profiles p on p.id = fp.profile_id
  group by fp.profile_id, p.slug
),
demo_profiles as (
  select pp.profile_id
  from profile_pref_set pp
  join demo_pref_set d on d.slug = pp.slug
  where (select array_agg(x order by x) from unnest(pp.food_ids) x)
      = (select array_agg(x order by x) from unnest(d.food_ids) x)
),
removed as (
  delete from public.food_preferences fp
  where fp.profile_id in (select profile_id from demo_profiles)
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '3_cleanup', 'demo_favorites_deleted (exact set match)', count(*) from removed;

-- ---------------------------------------------------------------------------
-- §4  Demo weigh-ins
--
-- Exact (weight_kg, body_fat_pct) pairs from demo-data.ts, and only for a
-- profile that has no weigh-in outside that set. A single real weigh-in makes
-- the profile untouchable — the values themselves are plausible, so they are
-- never sufficient alone. Health values appear here as match keys only; the
-- report counts rows, never values.
-- ---------------------------------------------------------------------------
with demo_weight (weight_kg, body_fat_pct) as (
  values (83.0::numeric, 24.6::numeric), (82.4::numeric, 24.1::numeric), (64.8::numeric, null::numeric)
),
matched as (
  select w.id, w.profile_id,
         exists (
           select 1 from demo_weight d
           where d.weight_kg = w.weight_kg
             and d.body_fat_pct is not distinct from w.body_fat_pct
         ) as is_demo
  from public.weigh_ins w
),
demo_only_profiles as (
  select profile_id from matched group by profile_id having bool_and(is_demo)
),
removed as (
  delete from public.weigh_ins w
  where w.profile_id in (select profile_id from demo_only_profiles)
    and w.id in (select id from matched where is_demo)
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '4_cleanup', 'demo_weigh_ins_deleted', count(*) from removed;

-- Weigh-ins that look like demo values but sit next to real ones: kept, counted.
insert into catalog_migration_report (step, detail, count)
select '4_cleanup', 'weigh_ins_preserved_ambiguous', count(*)
from public.weigh_ins w
where exists (
  select 1
  from (values (83.0::numeric, 24.6::numeric), (82.4::numeric, 24.1::numeric), (64.8::numeric, null::numeric))
       as d(weight_kg, body_fat_pct)
  where d.weight_kg = w.weight_kg
    and d.body_fat_pct is not distinct from w.body_fat_pct
);

-- ---------------------------------------------------------------------------
-- §5  Explicit E2E fixture food (e2e/crud.spec.ts creates this exact name)
-- ---------------------------------------------------------------------------
with removed as (
  delete from public.foods f
  where f.name = 'מאכל בדיקה' or f.normalized_name = 'מאכל בדיקה'
  returning 1
)
insert into catalog_migration_report (step, detail, count)
select '5_cleanup', 'e2e_fixture_foods_deleted', count(*) from removed;

-- ---------------------------------------------------------------------------
-- §6  Rows deliberately left alone, so the audit shows what remains
-- ---------------------------------------------------------------------------
insert into catalog_migration_report (step, detail, count)
values
  ('6_preserved', 'food_entries_remaining', (select count(*) from public.food_entries)),
  ('6_preserved', 'meal_statuses_remaining', (select count(*) from public.meal_statuses)),
  ('6_preserved', 'fasting_logs_remaining', (select count(*) from public.fasting_logs)),
  ('6_preserved', 'workout_logs_remaining', (select count(*) from public.workout_logs)),
  ('6_preserved', 'weigh_ins_remaining', (select count(*) from public.weigh_ins)),
  ('6_preserved', 'food_preferences_remaining', (select count(*) from public.food_preferences));

-- ---------------------------------------------------------------------------
-- §7  Catalog seed
--
-- Additive index: the unique constraint already covers
-- (household_id, normalized_name); this one serves prefix/equality lookups on
-- the catalog without being the conflict target.
-- ---------------------------------------------------------------------------
create index if not exists foods_household_normalized_idx
  on public.foods (household_id, normalized_name);

-- The rows below are generated from src/data/foods/*.ts by
-- `npm run catalog:seed` (scripts/generate-catalog-seed.ts). Editing them by
-- hand desynchronises the app from the database and fails
-- src/lib/catalog-seed.test.ts. Change the TypeScript modules and regenerate.
--
-- Every household gets the same catalog: the app is one household with two
-- profiles that share it (DEC-002). `created_by_profile_id` has no equivalent
-- in this schema — catalog rows are household-owned, not profile-owned, so a
-- seeded food is indistinguishable from "no author", which is what is wanted.
--
-- The upsert refreshes name/category/default_unit/kind and reactivates a row
-- that was archived, but writes no favorite, recency, usage or entry data of
-- any kind. There is deliberately no calorie, macro, score or label column.

-- >>> BEGIN GENERATED CATALOG SEED
with catalog (name, normalized_name, category, default_unit, kind) as (values
  ('מלפפון', 'מלפפון', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('עגבנייה', 'עגבניה', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('עגבניות שרי', 'עגבניות שרי', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('עגבניות מיובשות', 'עגבניות מיובשות', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('פלפל אדום', 'פלפל אדום', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('פלפל ירוק', 'פלפל ירוק', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('פלפל צהוב', 'פלפל צהוב', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('פלפל חריף', 'פלפל חריף', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('גזר', 'גזר', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('בצל', 'בצל', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('בצל סגול', 'בצל סגול', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('בצל ירוק', 'בצל ירוק', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('שום', 'שום', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('חסה', 'חסה', 'ירקות ועשבי תיבול', 'קערה', 'generic'),
  ('כרוב', 'כרוב', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('כרוב סגול', 'כרוב סגול', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('כרובית', 'כרובית', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('ברוקולי', 'ברוקולי', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('קישוא', 'קישוא', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('חציל', 'חציל', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('תפוח אדמה', 'תפוח אדמה', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('בטטה', 'בטטה', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('סלק', 'סלק', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('צנון', 'צנון', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('קולורבי', 'קולורבי', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('סלרי', 'סלרי', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('פטריות', 'פטריות', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('תירס', 'תירס', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('אפונה', 'אפונה', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('שעועית ירוקה', 'שעועית ירוקה', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('תרד', 'תרד', 'ירקות ועשבי תיבול', 'קערה', 'generic'),
  ('מנגולד', 'מנגולד', 'ירקות ועשבי תיבול', 'קערה', 'generic'),
  ('ארטישוק', 'ארטישוק', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('אספרגוס', 'אספרגוס', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('דלעת', 'דלעת', 'ירקות ועשבי תיבול', 'מנה', 'generic'),
  ('דלורית', 'דלורית', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('אבוקדו', 'אבוקדו', 'ירקות ועשבי תיבול', 'חצי יחידה', 'generic'),
  ('פטרוזיליה', 'פטרוזיליה', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('כוסברה', 'כוסברה', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('שמיר', 'שמיר', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('נענע', 'נענע', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('בזיליקום', 'בזיליקום', 'ירקות ועשבי תיבול', 'כף', 'generic'),
  ('זיתים', 'זיתים', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('מלפפון חמוץ', 'מלפפון חמוץ', 'ירקות ועשבי תיבול', 'יחידה', 'generic'),
  ('כרוב כבוש', 'כרוב כבוש', 'ירקות ועשבי תיבול', 'גרם', 'generic'),
  ('תפוח', 'תפוח', 'פירות', 'יחידה', 'generic'),
  ('בננה', 'בננה', 'פירות', 'יחידה', 'generic'),
  ('תפוז', 'תפוז', 'פירות', 'יחידה', 'generic'),
  ('קלמנטינה', 'קלמנטינה', 'פירות', 'יחידה', 'generic'),
  ('אשכולית', 'אשכולית', 'פירות', 'יחידה', 'generic'),
  ('פומלה', 'פומלה', 'פירות', 'מנה', 'generic'),
  ('לימון', 'לימון', 'פירות', 'יחידה', 'generic'),
  ('אגס', 'אגס', 'פירות', 'יחידה', 'generic'),
  ('אפרסק', 'אפרסק', 'פירות', 'יחידה', 'generic'),
  ('נקטרינה', 'נקטרינה', 'פירות', 'יחידה', 'generic'),
  ('שזיף', 'שזיף', 'פירות', 'יחידה', 'generic'),
  ('משמש', 'משמש', 'פירות', 'יחידה', 'generic'),
  ('ענבים', 'ענבים', 'פירות', 'גרם', 'generic'),
  ('אבטיח', 'אבטיח', 'פירות', 'מנה', 'generic'),
  ('מלון', 'מלון', 'פירות', 'מנה', 'generic'),
  ('תות שדה', 'תות שדה', 'פירות', 'גרם', 'generic'),
  ('אוכמניות', 'אוכמניות', 'פירות', 'גרם', 'generic'),
  ('פטל', 'פטל', 'פירות', 'גרם', 'generic'),
  ('דובדבנים', 'דובדבנים', 'פירות', 'גרם', 'generic'),
  ('מנגו', 'מנגו', 'פירות', 'יחידה', 'generic'),
  ('אננס', 'אננס', 'פירות', 'מנה', 'generic'),
  ('קיווי', 'קיוי', 'פירות', 'יחידה', 'generic'),
  ('רימון', 'רימון', 'פירות', 'יחידה', 'generic'),
  ('אפרסמון', 'אפרסמון', 'פירות', 'יחידה', 'generic'),
  ('תאנה', 'תאנה', 'פירות', 'יחידה', 'generic'),
  ('תמר', 'תמר', 'פירות', 'יחידה', 'generic'),
  ('גויאבה', 'גויאבה', 'פירות', 'יחידה', 'generic'),
  ('ליצ׳י', 'ליצי', 'פירות', 'גרם', 'generic'),
  ('פסיפלורה', 'פסיפלורה', 'פירות', 'יחידה', 'generic'),
  ('קוקוס', 'קוקוס', 'פירות', 'גרם', 'generic'),
  ('צימוקים', 'צימוקים', 'פירות', 'כף', 'generic'),
  ('משמש מיובש', 'משמש מיובש', 'פירות', 'כף', 'generic'),
  ('חמוציות מיובשות', 'חמוציות מיובשות', 'פירות', 'כף', 'generic'),
  ('שזיף מיובש', 'שזיף מיובש', 'פירות', 'כף', 'generic'),
  ('בננה מיובשת', 'בננה מיובשת', 'פירות', 'כף', 'generic'),
  ('פירות יבשים', 'פירות יבשים', 'פירות', 'כף', 'generic'),
  ('חלב', 'חלב', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב דל שומן', 'חלב דל שומן', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב ללא לקטוז', 'חלב ללא לקטוז', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב סויה', 'חלב סויה', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב שקדים', 'חלב שקדים', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב שיבולת שועל', 'חלב שיבולת שועל', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב עיזים', 'חלב עיזים', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('חלב קוקוס', 'חלב קוקוס', 'מוצרי חלב ותחליפים', 'מ״ל', 'generic'),
  ('יוגורט טבעי', 'יוגורט טבעי', 'מוצרי חלב ותחליפים', 'יחידה', 'generic'),
  ('יוגורט יווני', 'יוגורט יוני', 'מוצרי חלב ותחליפים', 'יחידה', 'generic'),
  ('יוגורט בטעמים', 'יוגורט בטעמים', 'מוצרי חלב ותחליפים', 'יחידה', 'generic'),
  ('משקה יוגורט', 'משקה יוגורט', 'מוצרי חלב ותחליפים', 'יחידה', 'generic'),
  ('מעדן חלב', 'מעדן חלב', 'מוצרי חלב ותחליפים', 'יחידה', 'generic'),
  ('קוטג׳', 'קוטג', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('גבינה לבנה', 'גבינה לבנה', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('גבינת שמנת', 'גבינת שמנת', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('גבינה צהובה', 'גבינה צהובה', 'מוצרי חלב ותחליפים', 'פרוסה', 'generic'),
  ('גבינה בולגרית', 'גבינה בולגרית', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('פטה', 'פטה', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('מוצרלה', 'מוצרלה', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('פרמזן', 'פרמזן', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('ריקוטה', 'ריקוטה', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('צפתית', 'צפתית', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('לאבנה', 'לאבנה', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('גבינת עיזים', 'גבינת עיזים', 'מוצרי חלב ותחליפים', 'גרם', 'generic'),
  ('שמנת חמוצה', 'שמנת חמוצה', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('שמנת מתוקה', 'שמנת מתוקה', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('חמאה', 'חמאה', 'מוצרי חלב ותחליפים', 'כף', 'generic'),
  ('ביצה קשה', 'ביצה קשה', 'ביצים', 'יחידה', 'generic'),
  ('ביצה רכה', 'ביצה רכה', 'ביצים', 'יחידה', 'generic'),
  ('ביצת עין', 'ביצת עין', 'ביצים', 'יחידה', 'generic'),
  ('חביתה', 'חביתה', 'ביצים', 'יחידה', 'generic'),
  ('ביצים מקושקשות', 'ביצים מקושקשות', 'ביצים', 'מנה', 'generic'),
  ('שקשוקה', 'שקשוקה', 'ביצים', 'מנה', 'generic'),
  ('חלבון ביצה', 'חלבון ביצה', 'ביצים', 'יחידה', 'generic'),
  ('לחם לבן', 'לחם לבן', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('לחם מלא', 'לחם מלא', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('לחם כוסמין', 'לחם כוסמין', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('לחם שיפון', 'לחם שיפון', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('לחם מחמצת', 'לחם מחמצת', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('לחם קל', 'לחם קל', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('פרוסת לחם', 'פרוסת לחם', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('חלה', 'חלה', 'לחם ומאפים', 'פרוסה', 'generic'),
  ('פיתה', 'פיתה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('פיתה מלאה', 'פיתה מלאה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('לאפה', 'לאפה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('טורטייה', 'טורטיה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('לחמנייה', 'לחמניה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('בגט', 'בגט', 'לחם ומאפים', 'יחידה', 'generic'),
  ('ג׳בטה', 'גבטה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('קרקר', 'קרקר', 'לחם ומאפים', 'יחידה', 'generic'),
  ('קרקר מלא', 'קרקר מלא', 'לחם ומאפים', 'יחידה', 'generic'),
  ('פריכית אורז', 'פריכית אורז', 'לחם ומאפים', 'יחידה', 'generic'),
  ('פריכית תירס', 'פריכית תירס', 'לחם ומאפים', 'יחידה', 'generic'),
  ('מצה', 'מצה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('בייגל', 'ביגל', 'לחם ומאפים', 'יחידה', 'generic'),
  ('בייגלה ירושלמי', 'ביגלה ירושלמי', 'לחם ומאפים', 'יחידה', 'generic'),
  ('מלאווח', 'מלאוח', 'לחם ומאפים', 'יחידה', 'generic'),
  ('ג׳חנון', 'גחנון', 'לחם ומאפים', 'יחידה', 'generic'),
  ('בורקס גבינה', 'בורקס גבינה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('בורקס תפוח אדמה', 'בורקס תפוח אדמה', 'לחם ומאפים', 'יחידה', 'generic'),
  ('קרואסון', 'קרואסון', 'לחם ומאפים', 'יחידה', 'generic'),
  ('אורז לבן', 'אורז לבן', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('אורז מלא', 'אורז מלא', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('אורז בסמטי', 'אורז בסמטי', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('אורז יסמין', 'אורז יסמין', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('פתיתים', 'פתיתים', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('קוסקוס', 'קוסקוס', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('בורגול', 'בורגול', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('קינואה', 'קינואה', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('כוסמת', 'כוסמת', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('שיבולת שועל', 'שיבולת שועל', 'דגנים ופחמימות', 'קערה', 'generic'),
  ('גרנולה', 'גרנולה', 'דגנים ופחמימות', 'קערה', 'generic'),
  ('קורנפלקס', 'קורנפלקס', 'דגנים ופחמימות', 'קערה', 'generic'),
  ('פסטה', 'פסטה', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('ספגטי', 'ספגטי', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('פנה', 'פנה', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('נודלס', 'נודלס', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('אטריות אורז', 'אטריות אורז', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('פולנטה', 'פולנטה', 'דגנים ופחמימות', 'מנה', 'generic'),
  ('סולת', 'סולת', 'דגנים ופחמימות', 'כוס', 'generic'),
  ('פירה', 'פירה', 'דגנים ופחמימות', 'כף', 'generic'),
  ('תפוחי אדמה אפויים', 'תפוחי אדמה אפוים', 'דגנים ופחמימות', 'מנה', 'generic'),
  ('תפוחי אדמה מבושלים', 'תפוחי אדמה מבושלים', 'דגנים ופחמימות', 'מנה', 'generic'),
  ('צ׳יפס', 'ציפס', 'דגנים ופחמימות', 'מנה', 'generic'),
  ('בטטה אפויה', 'בטטה אפויה', 'דגנים ופחמימות', 'מנה', 'generic'),
  ('חומוס מבושל', 'חומוס מבושל', 'קטניות', 'כוס', 'generic'),
  ('ממרח חומוס', 'ממרח חומוס', 'קטניות', 'כף', 'generic'),
  ('טחינה עם חומוס', 'טחינה עם חומוס', 'קטניות', 'כף', 'generic'),
  ('עדשים ירוקות', 'עדשים ירוקות', 'קטניות', 'כוס', 'generic'),
  ('עדשים כתומות', 'עדשים כתומות', 'קטניות', 'כוס', 'generic'),
  ('עדשים שחורות', 'עדשים שחורות', 'קטניות', 'כוס', 'generic'),
  ('שעועית לבנה', 'שעועית לבנה', 'קטניות', 'כוס', 'generic'),
  ('שעועית אדומה', 'שעועית אדומה', 'קטניות', 'כוס', 'generic'),
  ('שעועית שחורה', 'שעועית שחורה', 'קטניות', 'כוס', 'generic'),
  ('פול', 'פול', 'קטניות', 'כוס', 'generic'),
  ('לוביה', 'לוביה', 'קטניות', 'כוס', 'generic'),
  ('סויה', 'סויה', 'קטניות', 'גרם', 'generic'),
  ('אדממה', 'אדממה', 'קטניות', 'גרם', 'generic'),
  ('פלאפל', 'פלאפל', 'קטניות', 'יחידה', 'generic'),
  ('טופו', 'טופו', 'קטניות', 'גרם', 'generic'),
  ('חזה עוף', 'חזה עוף', 'עוף ובשר', 'גרם', 'generic'),
  ('חזה עוף בגריל', 'חזה עוף בגריל', 'עוף ובשר', 'גרם', 'generic'),
  ('חזה עוף מבושל', 'חזה עוף מבושל', 'עוף ובשר', 'גרם', 'generic'),
  ('פרגית', 'פרגית', 'עוף ובשר', 'גרם', 'generic'),
  ('שוק עוף', 'שוק עוף', 'עוף ובשר', 'יחידה', 'generic'),
  ('כרע עוף', 'כרע עוף', 'עוף ובשר', 'יחידה', 'generic'),
  ('כנפי עוף', 'כנפי עוף', 'עוף ובשר', 'יחידה', 'generic'),
  ('עוף בתנור', 'עוף בתנור', 'עוף ובשר', 'מנה', 'generic'),
  ('עוף בגריל', 'עוף בגריל', 'עוף ובשר', 'מנה', 'generic'),
  ('שניצל עוף', 'שניצל עוף', 'עוף ובשר', 'יחידה', 'generic'),
  ('שניצל אפוי', 'שניצל אפוי', 'עוף ובשר', 'יחידה', 'generic'),
  ('שניצל מטוגן', 'שניצל מטוגן', 'עוף ובשר', 'יחידה', 'generic'),
  ('הודו', 'הודו', 'עוף ובשר', 'גרם', 'generic'),
  ('פסטרמה', 'פסטרמה', 'עוף ובשר', 'פרוסה', 'generic'),
  ('בשר בקר', 'בשר בקר', 'עוף ובשר', 'גרם', 'generic'),
  ('סטייק', 'סטיק', 'עוף ובשר', 'גרם', 'generic'),
  ('אנטריקוט', 'אנטריקוט', 'עוף ובשר', 'גרם', 'generic'),
  ('סינטה', 'סינטה', 'עוף ובשר', 'גרם', 'generic'),
  ('פילה בקר', 'פילה בקר', 'עוף ובשר', 'גרם', 'generic'),
  ('בשר טחון', 'בשר טחון', 'עוף ובשר', 'גרם', 'generic'),
  ('המבורגר', 'המבורגר', 'עוף ובשר', 'יחידה', 'generic'),
  ('קציצות בקר', 'קציצות בקר', 'עוף ובשר', 'יחידה', 'generic'),
  ('קבב', 'קבב', 'עוף ובשר', 'יחידה', 'generic'),
  ('שווארמה עוף', 'שוארמה עוף', 'עוף ובשר', 'מנה', 'generic'),
  ('שווארמה הודו', 'שוארמה הודו', 'עוף ובשר', 'מנה', 'generic'),
  ('שווארמה בקר', 'שוארמה בקר', 'עוף ובשר', 'מנה', 'generic'),
  ('אסאדו', 'אסאדו', 'עוף ובשר', 'גרם', 'generic'),
  ('צלי בקר', 'צלי בקר', 'עוף ובשר', 'גרם', 'generic'),
  ('כבד עוף', 'כבד עוף', 'עוף ובשר', 'גרם', 'generic'),
  ('כבש', 'כבש', 'עוף ובשר', 'גרם', 'generic'),
  ('נקניקייה', 'נקניקיה', 'עוף ובשר', 'יחידה', 'generic'),
  ('נקניק', 'נקניק', 'עוף ובשר', 'פרוסה', 'generic'),
  ('סלמי', 'סלמי', 'עוף ובשר', 'פרוסה', 'generic'),
  ('סלמון', 'סלמון', 'דגים', 'גרם', 'generic'),
  ('טונה', 'טונה', 'דגים', 'גרם', 'generic'),
  ('טונה במים', 'טונה במים', 'דגים', 'גרם', 'generic'),
  ('טונה בשמן', 'טונה בשמן', 'דגים', 'גרם', 'generic'),
  ('דג לבן', 'דג לבן', 'דגים', 'גרם', 'generic'),
  ('אמנון', 'אמנון', 'דגים', 'גרם', 'generic'),
  ('דניס', 'דניס', 'דגים', 'גרם', 'generic'),
  ('לברק', 'לברק', 'דגים', 'גרם', 'generic'),
  ('בקלה', 'בקלה', 'דגים', 'גרם', 'generic'),
  ('סרדינים', 'סרדינים', 'דגים', 'גרם', 'generic'),
  ('מקרל', 'מקרל', 'דגים', 'גרם', 'generic'),
  ('פורל', 'פורל', 'דגים', 'גרם', 'generic'),
  ('חריימה', 'חרימה', 'דגים', 'מנה', 'generic'),
  ('קציצות דגים', 'קציצות דגים', 'דגים', 'יחידה', 'generic'),
  ('פילה דג מטוגן', 'פילה דג מטוגן', 'דגים', 'יחידה', 'generic'),
  ('פילה דג אפוי', 'פילה דג אפוי', 'דגים', 'יחידה', 'generic'),
  ('שרימפס', 'שרימפס', 'דגים', 'גרם', 'generic'),
  ('סושי סלמון', 'סושי סלמון', 'דגים', 'יחידה', 'generic'),
  ('סושי טונה', 'סושי טונה', 'דגים', 'יחידה', 'generic'),
  ('סשימי', 'סשימי', 'דגים', 'גרם', 'generic'),
  ('סלט ירקות', 'סלט ירקות', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט ישראלי', 'סלט ישראלי', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט חסה', 'סלט חסה', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט כרוב', 'סלט כרוב', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט יווני', 'סלט יוני', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט טונה', 'סלט טונה', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט ביצים', 'סלט ביצים', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט קינואה', 'סלט קינואה', 'מנות ותבשילים', 'קערה', 'generic'),
  ('סלט פסטה', 'סלט פסטה', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק ירקות', 'מרק ירקות', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק עוף', 'מרק עוף', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק עדשים', 'מרק עדשים', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק כתום', 'מרק כתום', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק עגבניות', 'מרק עגבניות', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק פטריות', 'מרק פטריות', 'מנות ותבשילים', 'קערה', 'generic'),
  ('מרק אפונה', 'מרק אפונה', 'מנות ותבשילים', 'קערה', 'generic'),
  ('קוסקוס עם ירקות', 'קוסקוס עם ירקות', 'מנות ותבשילים', 'מנה', 'generic'),
  ('מג׳דרה', 'מגדרה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('אורז עם עוף', 'אורז עם עוף', 'מנות ותבשילים', 'מנה', 'generic'),
  ('פתיתים עם ירקות', 'פתיתים עם ירקות', 'מנות ותבשילים', 'מנה', 'generic'),
  ('פסטה ברוטב עגבניות', 'פסטה ברוטב עגבניות', 'מנות ותבשילים', 'מנה', 'generic'),
  ('פסטה ברוטב שמנת', 'פסטה ברוטב שמנת', 'מנות ותבשילים', 'מנה', 'generic'),
  ('לזניה', 'לזניה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('רביולי', 'רביולי', 'מנות ותבשילים', 'מנה', 'generic'),
  ('ניוקי', 'ניוקי', 'מנות ותבשילים', 'מנה', 'generic'),
  ('מוסקה', 'מוסקה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('ממולאים', 'ממולאים', 'מנות ותבשילים', 'מנה', 'generic'),
  ('פלפל ממולא', 'פלפל ממולא', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('קישוא ממולא', 'קישוא ממולא', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('עלי גפן', 'עלי גפן', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('קציצות ברוטב', 'קציצות ברוטב', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('קציצות עוף', 'קציצות עוף', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('קציצות ירק', 'קציצות ירק', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('לביבות', 'לביבות', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('פשטידה', 'פשטידה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('קיש', 'קיש', 'מנות ותבשילים', 'מנה', 'generic'),
  ('חמין', 'חמין', 'מנות ותבשילים', 'מנה', 'generic'),
  ('גולאש', 'גולאש', 'מנות ותבשילים', 'מנה', 'generic'),
  ('מוקפץ ירקות', 'מוקפץ ירקות', 'מנות ותבשילים', 'מנה', 'generic'),
  ('מוקפץ עוף', 'מוקפץ עוף', 'מנות ותבשילים', 'מנה', 'generic'),
  ('נודלס מוקפץ', 'נודלס מוקפץ', 'מנות ותבשילים', 'מנה', 'generic'),
  ('סביח', 'סביח', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('פלאפל בפיתה', 'פלאפל בפיתה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('שווארמה בפיתה', 'שוארמה בפיתה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('חומוס עם פיתה', 'חומוס עם פיתה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('טוסט גבינה', 'טוסט גבינה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('כריך', 'כריך', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('כריך טונה', 'כריך טונה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('כריך חביתה', 'כריך חביתה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('פיצה', 'פיצה', 'מנות ותבשילים', 'מנה', 'generic'),
  ('המבורגר בלחמנייה', 'המבורגר בלחמניה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('נקניקייה בלחמנייה', 'נקניקיה בלחמניה', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('סושי', 'סושי', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('פוקי', 'פוקי', 'מנות ותבשילים', 'מנה', 'generic'),
  ('טאקו', 'טאקו', 'מנות ותבשילים', 'יחידה', 'generic'),
  ('שקדים', 'שקדים', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('אגוזי מלך', 'אגוזי מלך', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('קשיו', 'קשיו', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('פיסטוק', 'פיסטוק', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('בוטנים', 'בוטנים', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('אגוזי לוז', 'אגוזי לוז', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('פקאן', 'פקאן', 'אגוזים, גרעינים וממרחים', 'גרם', 'generic'),
  ('גרעיני חמנייה', 'גרעיני חמניה', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('גרעיני דלעת', 'גרעיני דלעת', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('צ׳יה', 'ציה', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('זרעי פשתן', 'זרעי פשתן', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('שומשום', 'שומשום', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('טחינה גולמית', 'טחינה גולמית', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('טחינה מוכנה', 'טחינה מוכנה', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('חמאת בוטנים', 'חמאת בוטנים', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('חמאת שקדים', 'חמאת שקדים', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('ממרח שוקולד', 'ממרח שוקולד', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('ריבה', 'ריבה', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('דבש', 'דבש', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('סילאן', 'סילאן', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('ממרח תמרים', 'ממרח תמרים', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('פסטו', 'פסטו', 'אגוזים, גרעינים וממרחים', 'כף', 'generic'),
  ('שוקולד חלב', 'שוקולד חלב', 'חטיפים ומתוקים', 'גרם', 'generic'),
  ('שוקולד מריר', 'שוקולד מריר', 'חטיפים ומתוקים', 'גרם', 'generic'),
  ('שוקולד לבן', 'שוקולד לבן', 'חטיפים ומתוקים', 'גרם', 'generic'),
  ('עוגייה', 'עוגיה', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('עוגת שוקולד', 'עוגת שוקולד', 'חטיפים ומתוקים', 'מנה', 'generic'),
  ('עוגת גבינה', 'עוגת גבינה', 'חטיפים ומתוקים', 'מנה', 'generic'),
  ('עוגת שמרים', 'עוגת שמרים', 'חטיפים ומתוקים', 'מנה', 'generic'),
  ('עוגת גזר', 'עוגת גזר', 'חטיפים ומתוקים', 'מנה', 'generic'),
  ('מאפין', 'מאפין', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('ופל', 'ופל', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('רוגלך', 'רוגלך', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('גלידה', 'גלידה', 'חטיפים ומתוקים', 'כוס', 'generic'),
  ('ארטיק', 'ארטיק', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('חטיף שוקולד', 'חטיף שוקולד', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('חטיף אנרגיה', 'חטיף אנרגיה', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('חטיף חלבון', 'חטיף חלבון', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('ביסלי', 'ביסלי', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('במבה', 'במבה', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('תפוצ׳יפס', 'תפוציפס', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('דוריטוס', 'דוריטוס', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('פופקורן', 'פופקורן', 'חטיפים ומתוקים', 'קערה', 'generic'),
  ('בייגלה', 'ביגלה', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('קרמבו', 'קרמבו', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('מלבי', 'מלבי', 'חטיפים ומתוקים', 'מנה', 'generic'),
  ('פודינג', 'פודינג', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('חלבה', 'חלבה', 'חטיפים ומתוקים', 'גרם', 'generic'),
  ('בקלאווה', 'בקלאוה', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('כדור שוקולד', 'כדור שוקולד', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('סוכריות', 'סוכריות', 'חטיפים ומתוקים', 'יחידה', 'generic'),
  ('קפה', 'קפה', 'משקאות', 'כוס', 'coffee'),
  ('מים', 'מים', 'משקאות', 'מ״ל', 'generic'),
  ('מים מוגזים', 'מים מוגזים', 'משקאות', 'מ״ל', 'generic'),
  ('סודה', 'סודה', 'משקאות', 'מ״ל', 'generic'),
  ('קפה שחור', 'קפה שחור', 'משקאות', 'כוס', 'generic'),
  ('קפה נמס', 'קפה נמס', 'משקאות', 'כוס', 'generic'),
  ('אספרסו', 'אספרסו', 'משקאות', 'כוס', 'generic'),
  ('אמריקנו', 'אמריקנו', 'משקאות', 'כוס', 'generic'),
  ('קפוצ׳ינו', 'קפוצינו', 'משקאות', 'כוס', 'generic'),
  ('קפה הפוך', 'קפה הפוך', 'משקאות', 'כוס', 'generic'),
  ('לאטה', 'לאטה', 'משקאות', 'כוס', 'generic'),
  ('תה', 'תה', 'משקאות', 'כוס', 'generic'),
  ('תה ירוק', 'תה ירוק', 'משקאות', 'כוס', 'generic'),
  ('תה צמחים', 'תה צמחים', 'משקאות', 'כוס', 'generic'),
  ('שוקו', 'שוקו', 'משקאות', 'כוס', 'generic'),
  ('מיץ תפוזים', 'מיץ תפוזים', 'משקאות', 'כוס', 'generic'),
  ('מיץ תפוחים', 'מיץ תפוחים', 'משקאות', 'כוס', 'generic'),
  ('מיץ ענבים', 'מיץ ענבים', 'משקאות', 'כוס', 'generic'),
  ('לימונדה', 'לימונדה', 'משקאות', 'כוס', 'generic'),
  ('משקה קל', 'משקה קל', 'משקאות', 'כוס', 'generic'),
  ('קולה', 'קולה', 'משקאות', 'כוס', 'generic'),
  ('קולה זירו', 'קולה זירו', 'משקאות', 'כוס', 'generic'),
  ('משקה אנרגיה', 'משקה אנרגיה', 'משקאות', 'יחידה', 'generic'),
  ('שייק פירות', 'שיק פירות', 'משקאות', 'כוס', 'generic'),
  ('סמוזי', 'סמוזי', 'משקאות', 'כוס', 'generic'),
  ('בירה', 'בירה', 'משקאות', 'כוס', 'generic'),
  ('יין אדום', 'ין אדום', 'משקאות', 'כוס', 'generic'),
  ('יין לבן', 'ין לבן', 'משקאות', 'כוס', 'generic'),
  ('ערק', 'ערק', 'משקאות', 'כוס', 'generic'),
  ('וודקה', 'ודקה', 'משקאות', 'כוס', 'generic'),
  ('ויסקי', 'ויסקי', 'משקאות', 'כוס', 'generic'),
  ('שמן זית', 'שמן זית', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('שמן קנולה', 'שמן קנולה', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב עגבניות', 'רוטב עגבניות', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב סויה', 'רוטב סויה', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב טריאקי', 'רוטב טריאקי', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב צ׳ילי', 'רוטב צילי', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב ברביקיו', 'רוטב ברביקיו', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב אלף האיים', 'רוטב אלף האים', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('ויניגרט', 'ויניגרט', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('רוטב לימון ושמן זית', 'רוטב לימון ושמן זית', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('חומץ בלסמי', 'חומץ בלסמי', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('מיונז', 'מיונז', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('קטשופ', 'קטשופ', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('חרדל', 'חרדל', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('עמבה', 'עמבה', 'רטבים, שמנים ותבלינים', 'כף', 'generic'),
  ('סחוג', 'סחוג', 'רטבים, שמנים ותבלינים', 'כפית', 'generic'),
  ('מלח', 'מלח', 'רטבים, שמנים ותבלינים', 'כפית', 'generic'),
  ('סוכר', 'סוכר', 'רטבים, שמנים ותבלינים', 'כפית', 'generic')
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
  -- is_active is deliberately NOT reset: if a household archived a food,
  -- re-running the seed must not resurrect it.
  returning (xmax::text::bigint = 0) as inserted
)
insert into catalog_migration_report (step, detail, count)
select '7_seed', case when inserted then 'foods_inserted' else 'foods_updated' end, count(*)
from upserted
group by inserted;

insert into catalog_migration_report (step, detail, count)
values
  ('7_seed', 'catalog_items_defined', 390),
  ('7_seed', 'households_seeded', (select count(*) from public.households));
-- <<< END GENERATED CATALOG SEED

-- ---------------------------------------------------------------------------
-- §8  After counts + result
-- ---------------------------------------------------------------------------
insert into catalog_migration_report (step, detail, count)
values
  ('8_after', 'households', (select count(*) from public.households)),
  ('8_after', 'profiles', (select count(*) from public.profiles)),
  ('8_after', 'foods', (select count(*) from public.foods)),
  ('8_after', 'foods_active', (select count(*) from public.foods where is_active)),
  ('8_after', 'foods_duplicate_normalized_names', (
    select coalesce(sum(c - 1), 0) from (
      select count(*) as c from public.foods group by household_id, normalized_name having count(*) > 1
    ) dupes
  )),
  ('8_after', 'food_entries', (select count(*) from public.food_entries)),
  ('8_after', 'meal_statuses', (select count(*) from public.meal_statuses)),
  ('8_after', 'fasting_logs', (select count(*) from public.fasting_logs)),
  ('8_after', 'workout_logs', (select count(*) from public.workout_logs)),
  ('8_after', 'weigh_ins', (select count(*) from public.weigh_ins)),
  ('8_after', 'food_preferences', (select count(*) from public.food_preferences));

select step, detail, count from catalog_migration_report order by step, detail;
