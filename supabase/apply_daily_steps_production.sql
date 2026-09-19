-- Production wrapper for migration 20260919044237_daily_steps.
-- Review first; run only through the approved SQL Editor / controlling migration tool.
-- Never run plain `supabase db push` against production (see supabase/DEPLOY.md).

begin;

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

grant select, insert, update, delete on table public.daily_steps to authenticated;
grant all on table public.daily_steps to service_role;
revoke all on table public.daily_steps from anon;

create index if not exists daily_steps_profile_date_idx
  on public.daily_steps(profile_id, log_date desc);

drop trigger if exists set_updated_at on public.daily_steps;
create trigger set_updated_at before update on public.daily_steps
  for each row execute function public.set_updated_at();

alter table public.daily_steps enable row level security;

drop policy if exists daily_steps_select on public.daily_steps;
create policy daily_steps_select on public.daily_steps for select to authenticated
  using (public.is_household_member(household_id));
drop policy if exists daily_steps_insert on public.daily_steps;
create policy daily_steps_insert on public.daily_steps for insert to authenticated
  with check (public.is_household_member(household_id));
drop policy if exists daily_steps_update on public.daily_steps;
create policy daily_steps_update on public.daily_steps for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
drop policy if exists daily_steps_delete on public.daily_steps;
create policy daily_steps_delete on public.daily_steps for delete to authenticated
  using (public.is_household_member(household_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='daily_steps'
  ) then
    alter publication supabase_realtime add table public.daily_steps;
  end if;
end;
$$;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';
    return;
  end if;
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('20260919044237', 'daily_steps', array['create table public.daily_steps ...'])
  on conflict (version) do nothing;
end;
$$;

commit;

-- Then run supabase/verify_daily_steps.sql read-only and retain its output.