-- Read-only verification for internal points v1.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and ((table_name='profiles' and column_name='daily_points_budget')
    or (table_name='food_entries' and column_name in ('points_value','points_model_version')))
order by table_name, ordinal_position;

select version, name
from supabase_migrations.schema_migrations
where version='20260919082000';

select schemaname, tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public' and tablename='profiles';

select relname as table_name, relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname in ('profiles','food_entries');
