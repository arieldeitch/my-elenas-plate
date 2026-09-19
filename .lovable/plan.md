# Production UX iteration: stable keyboard, quantity-first logging, and internal points

## Outcome
Deliver a compact mobile-first update that removes visible keyboard repositioning, restores deliberate quantity selection for typed foods, and adds a transparent per-profile daily points budget without calories, macros, or proprietary formulas.

## Implementation

1. **Start from the latest reviewed main**
   - Reconcile the working tree to `origin/main` (`64b894e`) before feature edits, preserving only intentional uncommitted work.
   - Keep anonymous authentication, household/profile separation, RLS, Realtime, durable offline operations, legacy local-data safeguards, and daily steps unchanged.

2. **Make sheets keyboard-stable from first focus**
   - Replace delayed smooth recentering with synchronous visual-viewport sizing and `scrollIntoView({ behavior: "auto", block: "nearest" })` only when the active control is outside the visible safe bounds.
   - Pre-position pointer/touch targets before focus where practical and update the viewport CSS variable immediately on focus/viewport resize.
   - Anchor mobile sheets to the visual viewport, preserve safe-area spacing, and suppress opening/reposition transitions while the software keyboard is active.
   - Apply the shared behavior to all existing input sheets/editors and add deterministic hook/component tests proving no smooth scroll, no delayed recenter, and visible focused fields/actions under a constrained viewport.

3. **Restore quantity-first typed search**
   - Give `FoodSearch` an explicit selection source (`typed` versus trusted quick chip).
   - Typed generic results always open `QuantitySelector`; coffee continues to open `CoffeeSelector`.
   - Favorite/recent chips retain one-tap add only when a trusted usual quantity exists, with the newly added row highlighted and its edit control immediately available.
   - Keep entry editing routed through `QuantitySelector`; rename its tabs to `מדידה` / `לפי תחושה`, retain all four exact subjective labels, expose suggested units plus `יחידות נוספות`, and preserve compact mobile layout.

4. **Add the independent points v1 model**
   - Add pure, tested `pointsForEntry`, `pointsForDay`, `pointsRemaining`, and `formatPoints` functions using the supplied category bases, measured/subjective factors, nearest-0.5 rounding, minimum 0.5 for positive non-zero portions, zero-point categories, unknown/custom fallback 4, and coffee simplification 0.
   - Extend food entries with immutable calculation snapshots (`pointsValue`, `pointsModelVersion: "v1"`) on add and quantity edit; preserve snapshots through mapper, queue, cloud roundtrip, hydration, offline replay, and Realtime. Older null snapshots calculate a display fallback from current catalog metadata without database backfill.
   - Extend profile state with `dailyPointsBudget`, local fallback 30, and a narrow idempotent `profile.points-budget.set` queue operation. Bootstrap profile budgets, update them through existing household RLS, subscribe to profile Realtime changes, and keep Ariel/Elena isolated.

5. **Add points UI without dashboard clutter**
   - Add a compact tappable points summary inside `TodayCard`: total/budget plus `נשארו X` or neutral amber `חריגה X`.
   - Add a small keyboard-safe `PointsBudgetEditor` for the active profile, clearly labeling the value as editable and the model as internal/simple.
   - Show read-only partner points where it fits, daily totals in Day Review, subtle per-entry points in MealEditor and Day Review, live points preview in QuantitySelector, and points in quick-add confirmation.
   - Recalculate immediately after add/edit/delete, selected-date changes, profile switches, hydration, and Realtime updates. Past dates use the current profile budget. Do not add a weekly bank.

6. **Create a forward-only database change, not a production deployment**
   - Add a new migration that adds `profiles.daily_points_budget integer NOT NULL DEFAULT 30 CHECK (> 0)` and nullable `food_entries.points_value numeric CHECK (>= 0)` / `points_model_version text` columns.
   - Preserve existing grants and household RLS; add `profiles` to Realtime only if not already published. Do not alter historical migrations or backfill existing food entries.
   - Update checked-in database types, mapper/repository code, fake cloud harness, and PGlite fixtures.
   - Add reviewed apply and read-only verify scripts. Do not run production SQL or plain `supabase db push`.

7. **Regression and release verification**
   - Add unit/component/integration coverage for all points formulas, snapshots, totals, add/edit/delete, typed versus quick quantity paths, subjective/custom units, per-profile budget fallback/edit, offline replay, and cross-device Realtime updates.
   - Extend mobile QA for the points summary, quantity screen, RTL/no-overflow behavior, and keyboard-constrained viewport at 360×740 and 412×915.
   - Run typecheck, lint, full Vitest/PGlite suite, hermetic Playwright, production build, and environment preflight. Record any environment-only browser blocker accurately rather than weakening tests.

8. **Document and hand off**
   - Add a durable decision explaining that this is a transparent internal category/portion model, intentionally not Weight Watchers and not nutritionally equivalent; calories/macros remain absent and weekly banking remains only a future candidate.
   - Update canonical decisions, project status, todo, context, deployment instructions, and one run record without creating duplicate documentation trees.
   - Produce coherent commit(s), push the implementation branch when permitted, and report exact revisions plus the single remaining production action: reviewed migration application/verification, then publish.

## Technical notes
- Existing null point snapshots remain readable through deterministic fallback calculation; all new or quantity-edited entries persist `v1` snapshots before queueing.
- Budget edits are profile-level operations, not day snapshots, so offline replay remains narrow and idempotent.
- Realtime profile changes refresh only profile settings and must not clobber pending local budget changes.
- The migration is additive and forward-only; no production data is rewritten or deleted.
