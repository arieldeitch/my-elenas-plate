-- Read-only verification for the device-join release (DEC-031). Run before and
-- after supabase/apply_anonymous_join_production.sql. Nothing here writes.

-- §1 Households: expected exactly ONE. If more exist, the OLDEST is the one every
--    device joins (it must be the July 2026 bootstrap with the seeded catalog).
select h.id, h.name, h.created_at,
       (select count(*) from public.profiles p where p.household_id = h.id) as profiles,
       (select count(*) from public.household_users hu where hu.household_id = h.id) as members,
       (select count(*) from public.foods f where f.household_id = h.id and f.is_active) as active_foods,
       (select count(*) from public.food_entries e where e.household_id = h.id) as entries
from public.households h
order by h.created_at, h.id;

-- §2 Profiles: expected exactly two rows in the oldest household (ariel, alena).
select p.household_id, p.slug, p.display_name, p.sort_order
from public.profiles p
order by p.household_id, p.sort_order;

-- §3 Function version + execute privileges. Expected after apply:
--    is_device_join_version = true, authenticated_can_execute = true, anon_can_execute = false.
select
  position('pg_advisory_xact_lock' in pg_get_functiondef('public.bootstrap_household()'::regprocedure)) > 0
    as is_device_join_version,
  has_function_privilege('authenticated', 'public.bootstrap_household()', 'execute') as authenticated_can_execute,
  has_function_privilege('anon', 'public.bootstrap_household()', 'execute') as anon_can_execute;

-- §4 Ledger: expected to list 20260725190000, 20260916120000 and (after apply) 20260918160000.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- §5 RLS still enabled on all 10 tables (expected: 10 rows, all true).
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- §6 Memberships: one row per device session / account (anonymous users accumulate; harmless).
select hu.household_id, hu.role, count(*) as sessions
from public.household_users hu
group by hu.household_id, hu.role
order by hu.household_id, hu.role;
