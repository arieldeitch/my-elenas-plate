-- Combined, idempotent deploy of all Nutrition Tracker migrations.
-- Paste into the Supabase Dashboard SQL Editor (project rqgoiuztphkcvbwtbxbj),
-- or apply via: supabase link --project-ref <ref> && supabase db push
-- Generated from supabase/migrations/*.sql — safe to re-run.

-- ========================================================================
-- supabase/migrations/20260723090000_schema.sql
-- ========================================================================
-- Nutrition Tracker — core schema
-- One shared Auth account (household). Two internal profiles (אריאל / אלנה).
-- Every household-owned row carries household_id; profile-owned rows add profile_id.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- Shared updated_at trigger function -----------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- households -----------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'משק בית',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- household_users: maps auth.users -> household (shared account membership) ---
create table if not exists public.household_users (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_users_user_idx on public.household_users (user_id);

-- profiles: exactly two per household (אריאל / אלנה) -------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, slug)
);
create index if not exists profiles_household_idx on public.profiles (household_id);

-- foods: household-scoped catalog --------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  category text,
  default_unit text,
  kind text not null default 'generic' check (kind in ('generic', 'coffee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);
create index if not exists foods_household_idx on public.foods (household_id);

-- food_preferences: favorite + recency per profile --------------------------
create table if not exists public.food_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  is_favorite boolean not null default false,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, food_id)
);
create index if not exists food_prefs_profile_idx on public.food_preferences (profile_id);

-- daily meal slot statuses ---------------------------------------------------
create table if not exists public.meal_statuses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  slot text not null check (
    slot in ('opening_window', 'first_snack', 'main_meal', 'afternoon_snack', 'dinner', 'extra_meal')
  ),
  status text not null default 'unmarked' check (status in ('unmarked', 'logged', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, log_date, slot)
);
create index if not exists meal_status_profile_date_idx on public.meal_statuses (profile_id, log_date);

-- food_entries: individual logged items (incl. coffee metadata) --------------
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  slot text not null check (
    slot in ('opening_window', 'first_snack', 'main_meal', 'afternoon_snack', 'dinner', 'extra_meal')
  ),
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null,
  quantity_mode text not null check (quantity_mode in ('measured', 'subjective')),
  amount numeric,
  unit text,
  subjective text check (subjective in ('little', 'moderate', 'much', 'excessive')),
  coffee jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- measured needs a positive amount + unit; subjective needs a subjective value.
  constraint quantity_valid check (
    (
      quantity_mode = 'measured'
      and amount is not null
      and amount > 0
      and unit is not null
    )
    or (quantity_mode = 'subjective' and subjective is not null)
  ),
  -- coffee: type required; milkType only when milk is "עם חלב" (domain string).
  constraint coffee_valid check (
    coffee is null
    or (
      (coffee ? 'type')
      and ((coffee ->> 'milk') = 'עם חלב' or not (coffee ? 'milkType'))
    )
  )
);
create index if not exists food_entries_profile_date_idx on public.food_entries (profile_id, log_date);

-- fasting: one window per profile/day ----------------------------------------
create table if not exists public.fasting_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  start_time text not null,
  end_time text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, log_date)
);
create index if not exists fasting_profile_date_idx on public.fasting_logs (profile_id, log_date);

-- workout: one record per profile/day ----------------------------------------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  performed boolean,
  workout_type text,
  feeling text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, log_date)
);
create index if not exists workout_profile_date_idx on public.workout_logs (profile_id, log_date);

-- weigh_ins ------------------------------------------------------------------
create table if not exists public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  measured_at text,
  weight_kg numeric not null check (weight_kg > 0),
  body_fat_pct numeric check (body_fat_pct > 0 and body_fat_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists weigh_ins_profile_idx on public.weigh_ins (profile_id, measured_on);

-- updated_at triggers --------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'profiles', 'foods', 'food_preferences', 'meal_statuses',
    'food_entries', 'fasting_logs', 'workout_logs', 'weigh_ins'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- ========================================================================
-- supabase/migrations/20260723090100_rls.sql
-- ========================================================================
-- Row Level Security. The authenticated shared account may access only rows
-- whose household it belongs to (via household_users). No service_role in the
-- client; RLS is the security boundary, never client-side filtering.

-- Membership check. SECURITY DEFINER so it does not re-trigger RLS on
-- household_users (which would recurse). Locked search_path for safety.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_users hu
    where hu.household_id = hid
      and hu.user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_users enable row level security;
alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.food_preferences enable row level security;
alter table public.meal_statuses enable row level security;
alter table public.food_entries enable row level security;
alter table public.fasting_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.weigh_ins enable row level security;

-- households: members may read/update their own household ---------------------
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (public.is_household_member(id)) with check (public.is_household_member(id));

-- household_users: a user sees their own membership rows ----------------------
drop policy if exists household_users_select on public.household_users;
create policy household_users_select on public.household_users
  for select using (user_id = auth.uid() or public.is_household_member(household_id));

-- Reusable per-table policy set keyed on household_id -------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'foods', 'food_preferences', 'meal_statuses',
    'food_entries', 'fasting_logs', 'workout_logs', 'weigh_ins'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (public.is_household_member(household_id));',
      t, t
    );

    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert with check (public.is_household_member(household_id));',
      t, t
    );

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format(
      'create policy %I_update on public.%I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));',
      t, t
    );

    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete using (public.is_household_member(household_id));',
      t, t
    );
  end loop;
end;
$$;

-- ========================================================================
-- supabase/migrations/20260723090200_bootstrap.sql
-- ========================================================================
-- First-login bootstrap for the shared household account.
-- Idempotent RPC: returns the existing household if the user already has one,
-- otherwise atomically creates the household, membership and the two profiles.

create or replace function public.bootstrap_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? return that household (idempotent, no duplicates).
  select hu.household_id into hid
  from public.household_users hu
  where hu.user_id = auth.uid()
  limit 1;

  if hid is not null then
    return hid;
  end if;

  insert into public.households (name)
  values ('משק בית')
  returning id into hid;

  insert into public.household_users (household_id, user_id, role)
  values (hid, auth.uid(), 'owner')
  on conflict (household_id, user_id) do nothing;

  insert into public.profiles (household_id, display_name, slug, sort_order)
  values
    (hid, 'אריאל', 'ariel', 1),
    (hid, 'אלנה', 'alena', 2)
  on conflict (household_id, slug) do nothing;

  return hid;
end;
$$;

-- Function execute grants (policies + RPC).
grant execute on function public.is_household_member(uuid) to authenticated, anon;
grant execute on function public.bootstrap_household() to authenticated;

-- ========================================================================
-- supabase/migrations/20260723090300_realtime.sql
-- ========================================================================
-- Enable Realtime for the user-facing data tables. Clients subscribe filtered
-- by household/profile/date. Safe to re-run: only adds tables not already in
-- the supabase_realtime publication.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'meal_statuses', 'food_entries', 'fasting_logs', 'workout_logs',
    'weigh_ins', 'food_preferences', 'foods', 'profiles'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end;
$$;

