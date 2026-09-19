-- Safe production apply for internal points v1.
-- Project: rqgoiuztphkcvbwtbxbj
-- Additive only; no historical food-entry backfill; never use plain db push.

begin;

alter table public.profiles
  add column if not exists daily_points_budget integer not null default 30
  check (daily_points_budget > 0);

alter table public.food_entries
  add column if not exists points_value numeric
  check (points_value is null or points_value >= 0);

alter table public.food_entries
  add column if not exists points_model_version text;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'profiles'
     ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (
      '20260919082000',
      'internal_points_v1',
      array[
        'alter table public.profiles add column daily_points_budget integer not null default 30',
        'alter table public.food_entries add columns points_value and points_model_version',
        'add public.profiles to supabase_realtime publication if absent'
      ]
    )
    on conflict (version) do nothing;
  end if;
end;
$$;

commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='daily_points_budget') as budget_column,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='food_entries' and column_name='points_value') as points_column,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='food_entries' and column_name='points_model_version') as version_column,
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') as profiles_realtime;
