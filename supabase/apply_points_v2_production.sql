-- ============================================================================
-- Points model v2-il (DEC-034) — apply migration 20260919100000 to PRODUCTION
-- (project rqgoiuztphkcvbwtbxbj) from the Dashboard SQL Editor / Management
-- API, and record it in the CLI migration ledger. Reviewed 2026-09-19
-- (docs/claude-tasks/RUN_2026-09-19_POINTS_V2_HARDENING.md).
--   * ADD COLUMN IF NOT EXISTS only (profiles: sex_at_birth, birth_date,
--     height_cm, goal_mode, points_budget_override) with CHECK constraints;
--   * one idempotent UPDATE that copies a deliberately changed v1 budget
--     (daily_points_budget <> 30) into points_budget_override once;
--   * no policy / grant / realtime / food_entries change; no snapshot rewrite.
-- HOW TO USE: run supabase/verify_points_v2.sql (read-only) before and after.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists sex_at_birth text
    check (sex_at_birth is null or sex_at_birth in ('male', 'female'));

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  add column if not exists height_cm numeric
    check (height_cm is null or (height_cm > 50 and height_cm < 260));

alter table public.profiles
  add column if not exists goal_mode text not null default 'lose'
    check (goal_mode in ('lose', 'maintain'));

alter table public.profiles
  add column if not exists points_budget_override integer
    check (points_budget_override is null or (points_budget_override >= 10 and points_budget_override <= 60));

update public.profiles
set points_budget_override = least(60, greatest(10, daily_points_budget))
where points_budget_override is null
  and daily_points_budget is not null
  and daily_points_budget <> 30;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';
    return;
  end if;
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('20260919100000', 'points_v2_profile_facts',
          array['alter table public.profiles add column if not exists sex_at_birth / birth_date / height_cm / goal_mode / points_budget_override (with checks)',
                'update public.profiles set points_budget_override = daily_points_budget where override is null and daily_points_budget <> 30'])
  on conflict (version) do nothing;
end;
$$;

commit;

-- Post-check (expected: 5 columns present; every profile row listed with its facts)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('sex_at_birth','birth_date','height_cm','goal_mode','points_budget_override')
order by column_name;
