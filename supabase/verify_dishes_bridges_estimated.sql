-- Read-only verification for dishes / weight bridges / estimated products (DEC-037).
-- Nothing here writes. Run BEFORE the apply (keep the output) and AFTER; §1 must
-- be identical and §2–§6 must match the expectations noted per section.

-- §1 Existing data — MUST be identical before and after the apply.
select (select count(*) from public.households) as households,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.foods) as foods,
       (select count(*) from public.food_entries) as food_entries,
       (select count(*) from public.food_reference_items) as reference_items,
       (select count(*) from public.food_reference_aliases) as reference_aliases;

-- §2 The four new tables exist with RLS enabled (expected after apply: 4 rows, all true).
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('dishes', 'dish_versions', 'estimated_products', 'weight_bridges')
order by c.relname;

-- §3 Policies, all scoped to authenticated (expected: 14 rows — four each for
-- dishes / estimated_products / weight_bridges, and SELECT + INSERT only for
-- the append-only dish_versions).
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('dishes', 'dish_versions', 'estimated_products', 'weight_bridges')
order by tablename, cmd;

-- §4 Privileges: anon has NOTHING (expected: no anon row); authenticated has
-- SELECT/INSERT/UPDATE/DELETE on the three mutable tables and SELECT + INSERT
-- only on dish_versions (a revision snapshot is never rewritten or erased).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('dishes', 'dish_versions', 'estimated_products', 'weight_bridges')
  and grantee in ('anon', 'authenticated')
order by grantee, table_name, privilege_type;

-- §5 The five additive columns on food_entries (expected: 5 rows, all is_nullable = YES).
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'food_entries'
  and column_name in ('dish_id', 'dish_revision', 'estimated_product_id', 'consumed_weight_g', 'weight_source')
order by column_name;

-- §6 Realtime publication includes the new tables (expected: 4 rows).
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename in ('dishes', 'dish_versions', 'estimated_products', 'weight_bridges')
order by tablename;

-- §7 The new tables start empty on a fresh apply (expected: 0, 0, 0, 0).
select (select count(*) from public.dishes) as dishes,
       (select count(*) from public.dish_versions) as dish_versions,
       (select count(*) from public.estimated_products) as estimated_products,
       (select count(*) from public.weight_bridges) as weight_bridges;

-- §8 Historical snapshots untouched: the basis distribution is unchanged by the apply.
select coalesce(points_basis, '(none)') as basis, coalesce(points_model_version, '(none)') as version,
       count(*) as entries
from public.food_entries
group by 1, 2
order by 1, 2;

-- §9 Manual daily targets are per profile and were not altered (DEC-037 R1 keeps the column).
select slug, display_name, points_budget_override as manual_daily_target
from public.profiles
order by sort_order;

-- §10 Ledger (expected after apply to include 20260923090000 dishes_bridges_estimated).
select version, name from supabase_migrations.schema_migrations
where version >= '20260921000000'
order by version;
