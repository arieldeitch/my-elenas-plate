-- Internal points model v1 — additive only.
-- Independent transparent behavioral score; not Weight Watchers' proprietary formula.
-- No historical backfill: existing rows keep NULL snapshots and the client calculates fallback display points.

alter table public.profiles
  add column if not exists daily_points_budget integer not null default 30
  check (daily_points_budget > 0);

alter table public.food_entries
  add column if not exists points_value numeric
  check (points_value is null or points_value >= 0);

alter table public.food_entries
  add column if not exists points_model_version text;

-- Profile budget changes must reach the partner/device in realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'profiles'
     ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
