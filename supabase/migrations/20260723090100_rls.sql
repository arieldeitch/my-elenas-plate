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
