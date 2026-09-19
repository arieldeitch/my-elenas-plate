-- Daily step goal + reporting (2026-09-19).
-- One row per profile/date. goal_steps is a snapshot of the goal that applied
-- to that day; steps=NULL + completed=true represents the quick "ביצעתי" mode.
-- Anonymous Auth users carry the authenticated DB role; unauthenticated anon
-- remains without table privileges. Additive, forward-only migration.

create table if not exists public.daily_steps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  goal_steps integer not null default 10000 check (goal_steps > 0),
  steps integer check (steps is null or steps >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, log_date)
);

create index if not exists daily_steps_profile_date_idx
  on public.daily_steps(profile_id, log_date desc);

drop trigger if exists set_updated_at on public.daily_steps;
create trigger set_updated_at
  before update on public.daily_steps
  for each row execute function public.set_updated_at();

alter table public.daily_steps enable row level security;

drop policy if exists daily_steps_select on public.daily_steps;
create policy daily_steps_select on public.daily_steps
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists daily_steps_insert on public.daily_steps;
create policy daily_steps_insert on public.daily_steps
  for insert to authenticated
  with check (public.is_household_member(household_id));

drop policy if exists daily_steps_update on public.daily_steps;
create policy daily_steps_update on public.daily_steps
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists daily_steps_delete on public.daily_steps;
create policy daily_steps_delete on public.daily_steps
  for delete to authenticated
  using (public.is_household_member(household_id));

revoke all on table public.daily_steps from anon;
grant select, insert, update, delete on table public.daily_steps to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_steps'
  ) then
    alter publication supabase_realtime add table public.daily_steps;
  end if;
end;
$$;
