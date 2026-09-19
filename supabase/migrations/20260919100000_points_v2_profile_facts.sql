-- Points model v2-il (DEC-034) — profile facts for the personalised daily budget.
-- Additive, forward-only, idempotent. Independent transparent model inspired by
-- public Weight Watchers principles; NOT the proprietary WW formula.
--
-- profiles gains the facts the budget derives from (never guessed / backfilled):
--   sex_at_birth, birth_date (age is computed, never stored), height_cm,
--   goal_mode, points_budget_override (manual target; NULL = automatic).
-- daily_points_budget (v1) is kept for the still-published v1 build; the v2
-- client no longer writes it. A non-default v1 value was a deliberate manual
-- choice by the person, so it becomes the explicit override once (30 = the v1
-- default = never chosen → stays automatic).
--
-- food_entries.points_model_version keeps 'v1' rows untouched; new/edited rows
-- write 'v2-il'. No snapshot is recalculated here. RLS/grants/realtime unchanged.

alter table public.profiles
  add column if not exists sex_at_birth text
    check (sex_at_birth is null or sex_at_birth in ('male', 'female'));

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  add column if not exists height_cm numeric
    check (height_cm is null or (height_cm > 50 and height_cm < 260));

alter table public.profiles
  add column if not exists goal_mode text not null default 'lose'
    check (goal_mode in ('lose', 'maintain'));

alter table public.profiles
  add column if not exists points_budget_override integer
    check (points_budget_override is null or (points_budget_override >= 10 and points_budget_override <= 60));

-- One-time carry-over of a deliberate v1 manual budget (idempotent: only rows
-- that still have no override and a non-default v1 value).
update public.profiles
set points_budget_override = least(60, greatest(10, daily_points_budget))
where points_budget_override is null
  and daily_points_budget is not null
  and daily_points_budget <> 30;
