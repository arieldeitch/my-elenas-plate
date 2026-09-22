-- Read-only verification for reference-only foods (DEC-036). Nothing here writes.
-- Run BEFORE apply (keep the output) and AFTER apply; §1 must be identical.

-- §1 Data counts — must not change across the apply.
select (select count(*) from public.households) as households,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.foods) as foods,
       (select count(*) from public.foods where is_active) as active_foods,
       (select count(*) from public.food_entries) as food_entries,
       (select count(*) from public.food_reference_items) as reference_items;

-- §2 The explicit-link column (expected after apply: 1 row, is_nullable YES) and its partial index.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'foods' and column_name = 'reference_group_key';
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'foods' and indexname = 'foods_reference_group_idx';

-- §3 Verified aliases (expected after apply: 76 rows, origin aliases-v1-2026-09-22; before: 0).
select origin, verified, count(*) from public.food_reference_aliases group by origin, verified order by origin;

-- §4 The required example: תפוח → תפוח עץ (expected after apply: 1 row).
select a.alias, i.display_name, i.points, i.status
from public.food_reference_aliases a
join public.food_reference_items i on i.id = a.item_id
where a.normalized_alias = 'תפוח';

-- §5 Every alias points at an ACTIVE reference row with a portion (expected: 0 rows).
select a.alias, i.display_name, i.status
from public.food_reference_aliases a
join public.food_reference_items i on i.id = a.item_id
where i.status <> 'active' or i.portion is null;

-- §6 RLS / privileges unchanged on the reference tables and foods (expected: RLS true everywhere;
--    authenticated has only SELECT on food_reference_aliases).
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('foods', 'food_entries', 'food_reference_items', 'food_reference_aliases')
order by c.relname;
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'food_reference_aliases' and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- §7 Historical snapshots untouched (same distribution as before apply).
select coalesce(points_basis, '(none)') as basis, coalesce(points_model_version, '(none)') as version,
       count(*) as entries
from public.food_entries
group by 1, 2
order by 1, 2;

-- §8 Ledger (expected after apply to include 20260922090000 reference_only_foods).
select version, name from supabase_migrations.schema_migrations
where version >= '20260921000000'
order by version;
