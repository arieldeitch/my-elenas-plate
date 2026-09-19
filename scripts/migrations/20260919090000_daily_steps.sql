-- Forward-only migration. Review and apply manually; do not run against production from this workspace.
begin;

create table if not exists public.profile_step_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  daily_goal integer not null default 10000 check (daily_goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create table if not exists public.daily_step_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  steps integer check (steps >= 0),
  completed boolean not null default false,
  goal integer not null check (goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, log_date),
  check (steps is not null or completed)
);

create index if not exists daily_step_logs_profile_date_idx
  on public.daily_step_logs (profile_id, log_date desc);

alter table public.profile_step_settings enable row level security;
alter table public.daily_step_logs enable row level security;

do $$
declare t text; op text;
begin
  foreach t in array array['profile_step_settings', 'daily_step_logs'] loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || op, t);
    end loop;
    execute format('create policy %I on public.%I for select using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.is_household_member(household_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.is_household_member(household_id))', t || '_delete', t);
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profile_step_settings', 'daily_step_logs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then execute format('alter publication supabase_realtime add table public.%I', t); end if;
  end loop;
end $$;

commit;
