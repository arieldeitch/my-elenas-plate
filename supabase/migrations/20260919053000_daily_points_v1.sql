-- Independent transparent daily-points model v1. Additive only; historical rows remain null.
alter table public.profiles
  add column if not exists daily_points_budget integer not null default 30;

alter table public.profiles
  drop constraint if exists profiles_daily_points_budget_check;
alter table public.profiles
  add constraint profiles_daily_points_budget_check
  check (daily_points_budget between 1 and 200);

alter table public.food_entries
  add column if not exists points_value numeric(8,2),
  add column if not exists points_model_version text;

alter table public.food_entries
  drop constraint if exists food_entries_points_value_check;
alter table public.food_entries
  add constraint food_entries_points_value_check
  check (points_value is null or points_value >= 0);

alter table public.food_entries
  drop constraint if exists food_entries_points_model_version_check;
alter table public.food_entries
  add constraint food_entries_points_model_version_check
  check (points_model_version is null or points_model_version = 'v1');
