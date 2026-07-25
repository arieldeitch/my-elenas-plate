-- ============================================================================
-- READ-ONLY verification for the cleanup + catalog seed migration
-- (20260725190000_cleanup_mock_data_and_seed_food_catalog.sql).
--
-- Contains no INSERT / UPDATE / DELETE / DDL — safe to run at any time, as often
-- as wanted. Returns counts and structural facts only: no food names, no
-- weights, no dates, no row contents of any kind, so the output can be pasted
-- back into a chat or an issue without exposing personal or health data.
--
-- Run it in the Supabase SQL Editor of project `rqgoiuztphkcvbwtbxbj` and read
-- the `status` column. Every row should read OK.
-- ============================================================================

with counts as (
  select
    (select count(*) from public.households) as households,
    (select count(*) from public.profiles) as profiles,
    (select count(*) from public.household_users) as memberships,
    (select count(*) from public.foods) as foods,
    (select count(*) from public.foods where is_active) as foods_active,
    (select count(*) from public.food_entries) as food_entries,
    (select count(*) from public.meal_statuses) as meal_statuses,
    (select count(*) from public.fasting_logs) as fasting_logs,
    (select count(*) from public.workout_logs) as workout_logs,
    (select count(*) from public.weigh_ins) as weigh_ins,
    (select count(*) from public.food_preferences) as food_preferences,
    (
      select coalesce(sum(c - 1), 0)
      from (
        select count(*) as c
        from public.foods
        group by household_id, normalized_name
        having count(*) > 1
      ) d
    ) as duplicate_normalized_names,
    (select count(*) from public.foods where coalesce(trim(name), '') = '') as blank_names,
    (
      select count(*) from public.foods where coalesce(trim(normalized_name), '') = ''
    ) as blank_normalized_names,
    -- The six eating windows are enforced as a CHECK constraint, not as rows.
    -- This counts the values the constraint allows, which is the real definition.
    (
      select count(*)
      from (
        values ('opening_window'), ('first_snack'), ('main_meal'),
               ('afternoon_snack'), ('dinner'), ('extra_meal')
      ) s(slot)
      where exists (
        select 1
        from pg_constraint c
        where c.conname = 'meal_statuses_slot_check'
          and pg_get_constraintdef(c.oid) like '%' || s.slot || '%'
      )
    ) as meal_slots_defined,
    (
      select count(*)
      from pg_tables t
      where t.schemaname = 'public'
        and t.tablename in (
          'households', 'household_users', 'profiles', 'foods', 'food_preferences',
          'meal_statuses', 'food_entries', 'fasting_logs', 'workout_logs', 'weigh_ins'
        )
        and t.rowsecurity
    ) as tables_with_rls,
    (
      select count(*)
      from public.profiles p
      where p.slug in ('ariel', 'alena')
    ) as expected_profile_slugs
)
select check_name, value::text as value, expected, status
from (
  select 'households' as check_name, households as value, '>= 1' as expected,
         case when households >= 1 then 'OK' else 'CHECK' end as status, 1 as ord from counts
  union all
  select 'profiles', profiles, '2 per household',
         case when profiles >= 2 then 'OK' else 'CHECK' end, 2 from counts
  union all
  select 'profile_slugs_ariel_alena', expected_profile_slugs, '2',
         case when expected_profile_slugs = 2 then 'OK' else 'CHECK' end, 3 from counts
  union all
  select 'memberships', memberships, '>= 1',
         case when memberships >= 1 then 'OK' else 'CHECK' end, 4 from counts
  union all
  select 'meal_slots_defined', meal_slots_defined, '6',
         case when meal_slots_defined = 6 then 'OK' else 'CHECK' end, 5 from counts
  union all
  select 'tables_with_rls', tables_with_rls, '10',
         case when tables_with_rls = 10 then 'OK' else 'CHECK' end, 6 from counts
  union all
  select 'foods_total', foods, '>= 390 per household',
         case when foods >= 390 then 'OK' else 'CHECK' end, 7 from counts
  union all
  select 'foods_active', foods_active, '= foods_total',
         case when foods_active = foods then 'OK' else 'CHECK' end, 8 from counts
  union all
  select 'foods_duplicate_normalized_names', duplicate_normalized_names, '0',
         case when duplicate_normalized_names = 0 then 'OK' else 'CHECK' end, 9 from counts
  union all
  select 'foods_blank_names', blank_names, '0',
         case when blank_names = 0 then 'OK' else 'CHECK' end, 10 from counts
  union all
  select 'foods_blank_normalized_names', blank_normalized_names, '0',
         case when blank_normalized_names = 0 then 'OK' else 'CHECK' end, 11 from counts
  union all
  select 'food_entries', food_entries, '0 before real logging starts',
         case when food_entries = 0 then 'OK' else 'REVIEW' end, 12 from counts
  union all
  select 'meal_statuses', meal_statuses, '0 before real logging starts',
         case when meal_statuses = 0 then 'OK' else 'REVIEW' end, 13 from counts
  union all
  select 'fasting_logs', fasting_logs, '0 before real logging starts',
         case when fasting_logs = 0 then 'OK' else 'REVIEW' end, 14 from counts
  union all
  select 'workout_logs', workout_logs, '0 before real logging starts',
         case when workout_logs = 0 then 'OK' else 'REVIEW' end, 15 from counts
  union all
  select 'weigh_ins', weigh_ins, '0 before real logging starts',
         case when weigh_ins = 0 then 'OK' else 'REVIEW' end, 16 from counts
  union all
  select 'food_preferences', food_preferences, '0 until a food is used',
         case when food_preferences = 0 then 'OK' else 'REVIEW' end, 17 from counts
) checks
order by ord;

-- Per-household catalog size, to confirm both profiles share one full catalog.
-- household_id is a random UUID and carries no personal information.
select
  h.id as household_id,
  count(f.id) filter (where f.is_active) as active_foods,
  count(f.id) filter (where not f.is_active) as archived_foods,
  count(distinct f.category) as categories
from public.households h
left join public.foods f on f.household_id = h.id
group by h.id
order by active_foods desc;

-- REVIEW rows above are not failures. They mean rows still exist in a tracking
-- table: either real logging has already begun (expected from 2026-07-26), or
-- rows were preserved because they could not be proven to be mock data. To see
-- WHICH table without exposing contents, read the counts above; the migration's
-- own report lists what it deleted and what it deliberately kept.
