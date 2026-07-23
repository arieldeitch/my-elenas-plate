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
