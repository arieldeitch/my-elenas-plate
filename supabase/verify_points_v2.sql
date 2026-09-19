-- Read-only verification for points v2-il (DEC-034). Nothing here writes.

-- §1 Profile facts columns (expected after apply: 5 rows).
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('sex_at_birth','birth_date','height_cm','goal_mode','points_budget_override')
order by column_name;

-- §2 The two profiles and their facts (no guessed values: null until entered in the app).
select slug, display_name, sex_at_birth, birth_date, height_cm, goal_mode,
       points_budget_override, daily_points_budget as legacy_v1_budget
from public.profiles
order by sort_order;

-- §3 Snapshot versions on food entries (v1 rows must remain v1 until deliberately edited).
select coalesce(points_model_version, '(none)') as version, count(*) as entries,
       min(created_at) as first_entry, max(created_at) as last_entry
from public.food_entries
group by 1
order by 1;

-- §4 Ledger (expected to include 20260919082000 and 20260919100000).
select version, name from supabase_migrations.schema_migrations
where version >= '20260919000000'
order by version;

-- §5 RLS still on for profiles and food_entries.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'food_entries');
