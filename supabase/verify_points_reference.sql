-- Read-only verification for the points reference (DEC-035). Nothing here writes.
-- Run BEFORE apply (expect §1 = 0 tables, §2 error/empty) and AFTER apply.

-- §1 The three reference tables exist with RLS enabled (expected after apply: 3 rows, all true).
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('food_reference_sources', 'food_reference_items', 'food_reference_aliases')
order by c.relname;

-- §2 Seed counts (expected: source v1-2026-09-21; 1394 rows;
--    active 1308 / needs_review 78 / conflict 6 / deprecated 2).
select id, version, sha256, imported_at from public.food_reference_sources;
select status, count(*) from public.food_reference_items group by status order by status;
select count(*) as total_rows from public.food_reference_items;

-- §3 The declared conflicts are present and hidden (expected: 6 rows, all 'conflict').
select source_row, source_name, source_quantity_text, points, category, status
from public.food_reference_items
where conflict_group is not null
order by source_row;

-- §4 Privileges: authenticated may only SELECT; anon has nothing (expected: SELECT rows for
--    authenticated only; no row for anon).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('food_reference_sources', 'food_reference_items', 'food_reference_aliases')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- §5 Policies: one SELECT policy per reference table, nothing else (expected: 3 rows, cmd SELECT).
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename like 'food_reference_%'
order by tablename;

-- §6 Additive columns on foods / food_entries (expected: 6 + 4 rows).
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'foods' and column_name in ('portion_amount','portion_unit','points_per_portion','points_status','created_by_profile_id','points_confirmed_at'))
    or (table_name = 'food_entries' and column_name in ('points_basis','reference_item_id','base_points','benefit_rule'))
  )
order by table_name, column_name;

-- §7 No historical snapshot was touched: existing entries keep null provenance until edited.
select coalesce(points_basis, '(none)') as basis, coalesce(points_model_version, '(none)') as version,
       count(*) as entries
from public.food_entries
group by 1, 2
order by 1, 2;

-- §8 Existing household data is intact (expected: same counts as before apply).
select (select count(*) from public.households) as households,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.foods where is_active) as active_foods,
       (select count(*) from public.food_entries) as food_entries;

-- §9 Ledger (expected to include 20260921120000 points_reference).
select version, name from supabase_migrations.schema_migrations
where version >= '20260919000000'
order by version;
