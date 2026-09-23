-- ============================================================================
-- Dishes, weight bridges and label-estimated products (DEC-037, 2026-09-23).
-- Additive, forward-only, idempotent, backward-compatible; rollback at the
-- bottom. No existing row, column, policy or grant is changed or removed.
--
-- WHY (docs/adr/ADR-2026-09-23-dishes-bridges-estimated.md)
--   The canonical reference (DEC-036) stays the only source of canonical food
--   values. This migration adds three DERIVED, household-scoped entities that
--   never write into food_reference_items / food_reference_aliases:
--     1. estimated_products — a product missing from the reference, scored from
--        nutrition-label values the person typed, normalised to a per-100 g
--        basis, clearly marked as an ESTIMATE (estimator_version).
--     2. weight_bridges     — an explicit "1 <unit> = N grams" fact for ONE
--        source identity, with provenance; never a guessed density, never
--        shared across brands/variants/reference identities.
--     3. dishes + dish_versions — a reusable household dish whose current
--        definition lives in `dishes` and whose every revision is an IMMUTABLE
--        ingredient snapshot in `dish_versions` (jsonb), so a meal logged from
--        revision N stays explainable after the dish is edited.
--   food_entries gains provenance columns so a logged serving names the dish
--   revision / estimated product / weighed-or-estimated grams it came from.
--
-- ACCESS MODEL
--   Exactly the existing household pattern: household_id + is_household_member,
--   policies for `authenticated` only, nothing for `anon`, set_updated_at
--   trigger, realtime publication. Creator kept in created_by_profile_id.
--   Manual daily targets remain on profiles.points_budget_override (per profile).
-- ============================================================================

-- 1. estimated products ------------------------------------------------------
create table if not exists public.estimated_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  brand text,
  -- What the person read off the package.
  label_basis text not null check (label_basis in ('per_100g', 'per_serving')),
  serving_weight_g numeric check (serving_weight_g is null or serving_weight_g > 0),
  label_calories numeric not null check (label_calories >= 0),
  label_protein_g numeric check (label_protein_g is null or label_protein_g >= 0),
  label_fiber_g numeric check (label_fiber_g is null or label_fiber_g >= 0),
  label_saturated_fat_g numeric check (label_saturated_fat_g is null or label_saturated_fat_g >= 0),
  label_added_sugar_g numeric check (label_added_sugar_g is null or label_added_sugar_g >= 0),
  label_unsaturated_fat_g numeric check (label_unsaturated_fat_g is null or label_unsaturated_fat_g >= 0),
  -- Deterministic normalisation of the above to 100 g (see src/lib/label-estimator.ts).
  points_per_100g numeric not null check (points_per_100g >= 0),
  estimator_version text not null default 'label-estimate-v1',
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a per-serving label is meaningless without the serving weight
  constraint estimated_products_serving_weight_required check (
    label_basis <> 'per_serving' or serving_weight_g is not null
  ),
  unique (household_id, normalized_name)
);
create index if not exists estimated_products_household_idx
  on public.estimated_products (household_id) where is_active;

-- 2. weight bridges ----------------------------------------------------------
create table if not exists public.weight_bridges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- 'reference' → source_key is the reference group key (reference_item_id pins
  -- the exact row the bridge was measured on); 'estimated' → the product id.
  source_kind text not null check (source_kind in ('reference', 'estimated')),
  source_key text not null,
  reference_item_id uuid references public.food_reference_items (id) on delete set null,
  estimated_product_id uuid references public.estimated_products (id) on delete cascade,
  unit text not null,
  grams_per_unit numeric not null check (grams_per_unit > 0),
  provenance text not null check (provenance in ('label', 'user_measured')),
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, source_kind, source_key, unit)
);
create index if not exists weight_bridges_household_idx
  on public.weight_bridges (household_id, source_kind, source_key);

-- 3. dishes + immutable versions ---------------------------------------------
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  revision integer not null default 1 check (revision >= 1),
  total_points numeric not null check (total_points >= 0),
  final_weight_g numeric not null check (final_weight_g > 0),
  points_per_gram numeric not null check (points_per_gram >= 0),
  usual_serving_weight_g numeric check (usual_serving_weight_g is null or usual_serving_weight_g > 0),
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);
create index if not exists dishes_household_idx on public.dishes (household_id) where is_active;

-- One immutable row per revision. `ingredients` is the write-once snapshot of
-- what the dish was made of (source identity, amounts, bridge used, points).
create table if not exists public.dish_versions (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  revision integer not null check (revision >= 1),
  name text not null,
  total_points numeric not null check (total_points >= 0),
  final_weight_g numeric not null check (final_weight_g > 0),
  points_per_gram numeric not null check (points_per_gram >= 0),
  usual_serving_weight_g numeric,
  ingredients jsonb not null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dish_id, revision)
);
create index if not exists dish_versions_dish_idx on public.dish_versions (dish_id, revision desc);

-- 4. food_entries: provenance of a dish / estimated serving --------------------
alter table public.food_entries add column if not exists dish_id uuid
  references public.dishes (id) on delete set null;
alter table public.food_entries add column if not exists dish_revision integer
  check (dish_revision is null or dish_revision >= 1);
alter table public.food_entries add column if not exists estimated_product_id uuid
  references public.estimated_products (id) on delete set null;
alter table public.food_entries add column if not exists consumed_weight_g numeric
  check (consumed_weight_g is null or consumed_weight_g > 0);
alter table public.food_entries add column if not exists weight_source text
  check (weight_source is null or weight_source in ('weighed', 'estimated'));

-- updated_at triggers ---------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['estimated_products', 'weight_bridges', 'dishes']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- privileges + RLS (identical to the existing household tables) ----------------
do $$
declare
  t text;
begin
  foreach t in array array['estimated_products', 'weight_bridges', 'dishes', 'dish_versions']
  loop
    execute format('revoke all on table public.%I from anon;', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role;', t);
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.is_household_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (public.is_household_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (public.is_household_member(household_id));',
      t, t
    );
  end loop;
end;
$$;

-- realtime --------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['estimated_products', 'weight_bridges', 'dishes', 'dish_versions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end;
$$;

-- ROLLBACK (manual; not part of the migration):
--   alter table public.food_entries
--     drop column if exists weight_source,
--     drop column if exists consumed_weight_g,
--     drop column if exists estimated_product_id,
--     drop column if exists dish_revision,
--     drop column if exists dish_id;
--   drop table if exists public.dish_versions;
--   drop table if exists public.dishes;
--   drop table if exists public.weight_bridges;
--   drop table if exists public.estimated_products;
