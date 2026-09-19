# Run — 2026-09-19 — calmer UX, keyboard safety, and daily steps

## Scope

Implemented DEC-032 only: calmer light surfaces and clearer card boundaries, keyboard-safe input
editors, three-action bottom navigation, balanced four-tile daily context, and shared daily steps.

## Product behavior

- Home / Quick Add / Journal are the only visible bottom actions.
- Daily context is 2×2 on narrow phones and four columns on wider screens.
- Steps can be an exact nonnegative count or completed-only; the goal must be positive.
- All writes use the active profile and selected date, including past dates.
- The latest saved goal carries forward per profile; historical rows keep their goal snapshot.

## Sync and data

`daily_steps` is one row per profile/date. `steps.set` is a narrow, coalescing durable operation;
hydration protects pending/in-flight days; reconnect retries; Realtime refreshes the affected person/date.
No full-day destructive write was introduced.

## Production safety

Production SQL was not applied. Review `supabase/migrations/20260919044237_daily_steps.sql`, apply only
`supabase/apply_daily_steps_production.sql` through the approved path, then retain the read-only output
from `supabase/verify_daily_steps.sql`. Never run plain `supabase db push`.

## Verification

Final command results and revision are recorded in the final delivery report. No Docker was started.
