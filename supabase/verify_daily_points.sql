-- Read-only verification for daily points v1.
begin transaction read only;
select table_name, column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'profiles' and column_name = 'daily_points_budget')
    or (table_name = 'food_entries' and column_name in ('points_value','points_model_version')))
order by table_name, column_name;
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname in ('profiles_daily_points_budget_check','food_entries_points_value_check','food_entries_points_model_version_check')
order by conname;
select has_table_privilege('authenticated', 'public.profiles', 'SELECT,UPDATE') as profiles_authenticated,
       has_table_privilege('authenticated', 'public.food_entries', 'SELECT,INSERT,UPDATE,DELETE') as entries_authenticated,
       (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) as profiles_rls,
       (select relrowsecurity from pg_class where oid = 'public.food_entries'::regclass) as entries_rls;
select version from supabase_migrations.schema_migrations where version = '20260919053000';
rollback;
