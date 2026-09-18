-- ============================================================================
-- READ-ONLY: table-privilege + migration-ledger report for the Nutrition App.
-- Safe to run any number of times, on production or on a branch. Paste into
-- the Supabase Dashboard SQL Editor or run with psql. Modifies nothing.
--
-- Use it BEFORE and AFTER applying 20260916120000_grant_table_privileges.sql
-- (see supabase/DEPLOY.md §"M1 release"). Expected AFTER state on production:
--   * authenticated + service_role: SELECT/INSERT/UPDATE/DELETE on all 10 tables
--   * anon: whatever it had before (the migration never revokes) — RLS denies it
--   * default privileges for role postgres include the same four for both roles
--   * every public table has RLS enabled
--   * ledger contains 20260916120000 (and 20260725190000, applied 2026-07-25)
-- ============================================================================

-- 1. Per-role privilege summary on public tables (one row per role/table).
select
  t.tablename,
  r.rolname as role,
  string_agg(g.privilege_type, ',' order by g.privilege_type) as privileges
from pg_tables t
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
left join information_schema.role_table_grants g
  on g.table_schema = t.schemaname
 and g.table_name = t.tablename
 and g.grantee = r.rolname
where t.schemaname = 'public'
group by t.tablename, r.rolname
order by t.tablename, r.rolname;

-- 2. Tables where authenticated is missing any of the four privileges
--    (expected: zero rows after the migration).
select t.tablename,
       array(select p from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
             except
             select privilege_type from information_schema.role_table_grants g
             where g.table_schema = 'public' and g.table_name = t.tablename
               and g.grantee = 'authenticated') as missing_for_authenticated
from pg_tables t
where t.schemaname = 'public'
  and exists (
    select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
    except
    select privilege_type from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = t.tablename
      and g.grantee = 'authenticated');

-- 3. Default privileges (what future tables created by postgres will get).
select defaclrole::regrole as owner_role,
       defaclnamespace::regnamespace as schema,
       defaclobjtype as objtype,
       defaclacl as acl
from pg_default_acl
where defaclnamespace = 'public'::regnamespace;

-- 4. Schema USAGE on public for the API roles.
select r.rolname,
       has_schema_privilege(r.rolname, 'public', 'USAGE') as usage_on_public
from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname);

-- 5. RLS must be enabled on every public table (expected: all true, 10 rows).
select relname as tablename, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 6. SECURITY DEFINER functions must pin search_path (expected: both pinned).
select p.proname,
       p.prosecdef as security_definer,
       p.proconfig as config
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prosecdef;

-- 7. Migration ledger as the Supabase CLI sees it.
select version, name
from supabase_migrations.schema_migrations
order by version;
