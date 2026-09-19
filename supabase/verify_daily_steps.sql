-- Read-only verification for migration 20260919044237_daily_steps.

select
  c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated','public.daily_steps','select,insert,update,delete') as authenticated_crud,
  has_table_privilege('anon','public.daily_steps','select') as anon_select,
  exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='daily_steps'
  ) as realtime_enabled,
  (select count(*) from public.daily_steps) as row_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='daily_steps';

select version, name
from supabase_migrations.schema_migrations
where version='20260919044237';
