# Run record — 2026-09-19 (twelfth run) — points model v2-il + keyboard/quantity/sync hardening

**Objective (2-hour window):** review Lovable's DEC-033 implementation, harden keyboard / quantity /
points / sync, and refine the points model to be closer in spirit to the historical Israeli "שומרי
משקל" system Elena knows — versioned, transparent, not the proprietary WW formula — with a personalised
daily target. Prompt: `RUN_2026-09-19_POINTS_V2_HARDENING.prompt.md`. Decision: DEC-034.

**Outcome:** repository `GREEN` (all gates), model v2-il on `main` with a personalised budget and a
new forward-only migration prepared (apply + verify scripts) but **NOT applied** to production; the
served build is still the pre-v2 `main`. Lovable must publish after the migration is applied.

## A. Baseline (start, `f99254e`)

install no changes · typecheck 0 · **lint 5 prettier errors** (Lovable's DayReview / MealEditor /
PartnerGlance / store / QuantitySelector formatting) · vitest **348 passed / 2 failed / 16 skipped** ·
build OK · preflight `--env` PASS · hermetic Playwright **6 passed / 2 failed**. All three breakages were
stale expectations against Lovable's new behaviour (profiles realtime table, one profiles read, typed
results now always open the quantity screen) — fixed at the root (tests ported), no product regression.

## B–S. Points model v2-il (`8914aef`, `docs/decisions.md` DEC-034)

- **Versioning:** `POINTS_MODEL_VERSION = "v2-il"`; `scoreEntry` stamps every new/edited entry;
  `pointsForEntry` always prefers the persisted snapshot; a `v1` snapshot (fruit = 0) is displayed as
  0 and becomes v2-il only through `store.updateEntry` (deliberate edit). Proven in
  `multi-device.test.tsx` against the fake rows: activation/hydration writes nothing back.
- **Hierarchy:** `pointsPerPortion` (calibrated) → `NutritionFacts` (real, linear, normalised to a
  standard portion) → category fallback; coffee and vegetables 0. Nothing fabricated: the built-in
  catalog carries no `nutrition`; the catalog invariant test allows only `pointsPerPortion`.
- **Vegetables 0 at any quantity**, including the four plain vegetable salads that the catalog files
  under "מנות ותבשילים" (found by the calibration table: "סלט ירקות" 1 bowl was 7.5 → now 0). Light
  vegetable soups 1, Greek salad 2, vegetable stir-fry 2 — per-food calibration, documented.
- **Fruit positive:** 1 per standard portion; 150 g = 1.5; subjective 0.5/1/1.5/2.
- **Units:** weight/volume vs count/serving families, standard portion 100 g / 250 ml, count fractions
  (tbsp 0.25, tsp 0.1, mug 1.25, bowl 1.5…), 1 g never a portion, min 0.5 for a non-zero food.
- **`mergeCatalog` defect fixed:** a seeded cloud row of the same food replaced the built-in object and
  would have dropped the calibration in production (salads charged 5 again). Now carried over; tested.

## J–Q. Personalised daily budget

`calculatePersonalizedPointsBudget({sexAtBirth, age, heightCm, weightKg, goalMode})` — Mifflin-St Jeor
BMR → `23 × BMR/1400`, clamp 14–45, maintenance ×1.2, rounding 1 (all in `points-config.ts` `BUDGET_V2`).
`resolvePointsBudget(facts, latestWeightKg)`: override → personalised → fallback 23 with the list of
missing facts. Age from `birth_date` (birthday-boundary tests). Weight = latest valid weigh-in of that
profile (new weigh-in re-derives the budget; food snapshots untouched). Profile isolation and realtime
proven (Ariel's facts/weigh-in move only Ariel; Elena's `profiles`/`weigh_ins` events move only Elena).

## AB. Database

New migration `supabase/migrations/20260919100000_points_v2_profile_facts.sql` (profiles:
`sex_at_birth`, `birth_date`, `height_cm`, `goal_mode`, `points_budget_override` with CHECKs; one
idempotent carry-over of a non-default v1 budget into the override). Apply script
`supabase/apply_points_v2_production.sql` (ledger row + post-check), read-only
`supabase/verify_points_v2.sql`. PGlite proves: columns/defaults, constraint rejections, carry-over (27
→ override, 30 → null), members can update their facts, a stranger cannot. **Not applied** to
production in this run (policy: no automatic schema apply). The v2 client tolerates the missing columns
only for reads (`select *` → undefined → fallback budget) but **writes of profile facts would fail
until the migration is applied** → apply BEFORE publishing.

## T–U. Quantity flow

Typed result → quantity screen (מדידה / לפי תחושה, "יחידות נוספות", instant v2 preview with
`data-points`); chips stay one-tap only with a trusted usual quantity (unchanged). **Fixed:** editing
merged the submitted quantity over the old entry (`{...editing, ...entry}`), so switching
measured ↔ subjective left the other mode's fields in the persisted row — now `withQuantity` replaces
the quantity whole. Unit and subjective buttons carry `aria-pressed`; preview is `aria-live`.

## V. Keyboard

Audit of `use-keyboard-safe-viewport.ts`: the touch `pointerdown` handler centred **every** tapped
control (`scrollIntoView({block:"center"})`) — a control already visible in the upper half jumped
before the keyboard opened (the exact "opened, then corrected" feeling). Now pre-positioning happens
only when the control sits in the lower half (`KEYBOARD_ZONE_FROM = 0.5`); focus/resize corrections
stay instant nearest-edge and only when genuinely obscured; no timers, no smooth scroll. Tests: upper
half → no motion; keyboard zone → one instant centring. **Browser emulation ≠ physical keyboard proof.**

## AD/AE. Accessibility, RTL, performance

axe (wcag2a/aa) at 360×740 and 412×915: quantity measured/subjective, budget sheet — **0 violations**,
no horizontal overflow. Budget derivation is pure and memoised on `[profileFactsMap, weighInsMap]`;
profile facts arrive with the bootstrap read (exactly one `profiles` select on activation, asserted);
realtime `profiles` → one facts re-read; no new subscriptions; one write per facts save (coalesced).

## Tests

`bun run typecheck` 0 · `bun run lint` 0 errors / 8 warnings · `bun run test` **396 passed / 16
skipped (46 files)** · hermetic Playwright **8/8** · `vite build` OK · `preflight --env` PASS. New:
`points-v2.test.ts` (39), PGlite (+1 = 15), multi-device (+4 = 15 + budget), keyboard (+2 = 4).

## Git

`f99254e` → `8914aef` (model, budget, migration, UI, tests) → `<docs/calibration commit>` (see
`git log`). Pushed to `origin/main`; worktree clean.

---

# FINAL REPORT

## STATUS

- **repo:** `GREEN` — all gates green after fixing the three stale expectations.
- **keyboard:** improved on `main` (no pre-focus jump for visible controls); physical-device proof pending.
- **quantity:** `GREEN` — typed → quantity screen, mode switch no longer leaks fields, instant preview.
- **points v2-il:** `GREEN` on `main`; calibration by Elena pending (table below).
- **personalized budget:** `GREEN` on `main` (Mifflin-St Jeor backbone, override, fallback, isolation).
- **Supabase:** migration `20260919100000` **prepared, not applied**; production schema is still v1.
- **production:** serves pre-v2 `main`; publish only after the migration is applied.
- **real-device acceptance:** pending (M1 §3b + this run's three phone checks).

## STARTING STATE

`main` @ `f99254e` = `origin/main`, clean. Lint 5 errors, vitest 2 failures, hermetic 2 failures — all
stale expectations vs Lovable's DEC-033 changes.

## FINDINGS

1. Keyboard: unconditional centring on every touch of an input (visible jump) — P1.
2. Quantity edit merged fields across mode switches (stale amount/unit/subjective persisted) — P1.
3. Vegetable salads filed under "dishes" cost 7.5 points per bowl — P1 model defect.
4. `mergeCatalog` dropped per-food calibration when a cloud row matched — P1 (production path).
5. v1 fruit = 0 and a fixed 30 target — replaced by DEC-034.
6. Lovable's formatting and three stale test expectations.

## FIXES

All six above; see sections B–V. No feature added.

## POINTS MODEL

**WW-like:** one simple value per food; preferable foods cost less; saturated fat / added sugar raise,
protein / fibre / unsaturated fat lower (nutrition path); allowance personalised from the body; neutral
language; half-point granularity. **Intentionally different:** vegetables 0 always; **fruit positive**
(1/portion — the older Israeli model, so a banana is not free); category fallback is a transparent
approximation, not the WW formula. **Category fallback vs nutrition-aware:** today every catalog food
scores by category (plus a handful of per-food calibrations); the nutrition path exists but no food
carries facts — none were invented.

## PERSONALIZED DAILY TARGET

`BMR = 10·kg + 6.25·cm − 5·age + (male 5 | female −161)` (Mifflin-St Jeor, public) →
`raw = 23 × BMR / 1400` → clamp [14, 45] → maintenance ×1.2 → round to 1. Fallback 23 while facts are
missing; manual override 10–60 wins. Constants: `src/lib/points-config.ts` `BUDGET_V2`. Not the official
Weight Watchers formula; not a calorie prescription.

## SNAPSHOT VERSIONING

v1 rows keep `points_value` + `'v1'` forever unless deliberately edited; new/edited → `'v2-il'`;
display = persisted snapshot; rows without a snapshot get a v2 estimate for display only; no backfill.

## QUANTITY FLOW

Typed result → quantity screen (tabs מדידה / לפי תחושה, suggested units + יחידות נוספות, subjective
מעט/במידה/יותר מדי/מוגזם), preview updates on amount/unit/mode/level; edit restores exact
mode/value/unit and replaces the quantity whole; chips one-tap only with a trusted usual quantity;
quick add snapshots are v2-il and +/− re-scores.

## KEYBOARD

Automated proof: unit tests (no motion for a visible control; one instant centring in the keyboard
zone; no smooth/delayed recenter) — emulation only. Physical proof: Ariel's phone check below.

## PROFILE / BUDGET ISOLATION

Proven: Ariel's facts + weigh-in change only Ariel's budget and only Ariel's `profiles` row; Elena's
facts arriving by realtime change only Elena's; override/clear per profile; one channel.

## OFFLINE / REALTIME

Offline write → replay keeps v2-il snapshot; B's scored entry reaches A via realtime with the snapshot
intact; profile facts and weigh-in realtime update the right budget; no duplicate subscriptions.

## DATABASE / MIGRATION

`20260919100000_points_v2_profile_facts.sql` — ADD COLUMN IF NOT EXISTS ×5 with CHECKs + one
idempotent carry-over UPDATE. Apply: `supabase/apply_points_v2_production.sql`; verify:
`supabase/verify_points_v2.sql`. State: **prepared, tested in PGlite, not applied.**

## SECURITY / RLS

No policy/grant change; new columns are covered by the existing `profiles` policies (member update,
stranger denied — tested); no service_role in the browser; DEC-031 untouched.

## ACCESSIBILITY / RTL

axe 0 violations on the quantity screen (both tabs) and the budget sheet at both viewports; radios /
tabs / pressed states labelled; numeric fields `inputMode`; RTL numbers render correctly.

## PERFORMANCE

One `profiles` read on activation (facts ride on the bootstrap read); budget is a memoised pure
function; no catalog scans per render beyond the existing `foods.find` on add/edit; one coalesced write
per facts save.

## TESTS

`bun run typecheck` 0 · `bun run lint` 0/8 · `bun run test` 396 passed / 16 skipped · `npx playwright
test -c playwright.hermetic.config.ts` 8 passed · `npx vite build` OK · `npm run preflight -- --env`
PASS (5). QA script at 360/412 with axe: 0 violations.

## GIT

`f99254e` → `8914aef` → docs/calibration commit (HEAD; see `git log`); `origin/main` = HEAD; worktree
clean.

## DOCUMENTATION

`docs/decisions.md` (DEC-034), `docs/claude-tasks/RUN_2026-09-19_POINTS_V2_HARDENING.md` (+
`.prompt.md`), `docs/project-status.md`, `docs/todo.md`, `docs/claude-context.md`, `supabase/DEPLOY.md`.

## ELENA CALIBRATION TABLE

Current v2-il estimate (category fallback unless noted). Question for Elena, later: **"האם זה מרגיש
נמוך / נכון / גבוה ביחס לשיטה שהכרת?"** — no formulas asked.

| Food        | Quantity | v2-il | Basis                  |
| ----------- | -------- | ----- | ---------------------- |
| תפוח        | 1 יחידה  | 1     | fruit fallback         |
| בננה        | 1 יחידה  | 1     | fruit fallback         |
| פרוסת לחם   | 1 פרוסה  | 3     | breads                 |
| ביצה קשה    | 1 יחידה  | 2     | eggs                   |
| חזה עוף     | 150 גרם  | 4.5   | chicken/meat 3/portion |
| אורז לבן    | 1 מנה    | 3     | grains                 |
| שוקולד חלב  | 30 גרם   | 2     | sweets 6/portion       |
| שמן זית     | 1 כף     | 1     | oils 4/portion         |
| יוגורט טבעי | 1 יחידה  | 2     | dairy                  |
| חומוס מבושל | 2 כף     | 1     | legumes 2/portion      |
| קוטג׳       | 100 גרם  | 2     | dairy                  |
| סלט ירקות   | 1 קערה   | 0     | calibrated (vegetable) |

## YOU

After the controlling GPT applies the migration and Lovable publishes — three things on your phone:

1. Tap the points line on the today card → fill sex, birth date, height → save; log a weigh-in → the
   target should change from 23 to your personal number (and Elena's stays hers).
2. Type a food, add "150 גרם" of something, then edit it to "לפי תחושה · יותר מדי" → the row and its
   points should show only the new choice.
3. Tap the search box and a number field while the keyboard is closed → the field should not move
   before the keyboard appears.

## NEXT

Apply `supabase/apply_points_v2_production.sql` (GPT) → Lovable publish → the three phone checks → §3b
→ Ariel/Elena real-use calibration of the table above. No new feature sprint.

## RUN TIMESTAMP

2026-09-19 09:20 local time (Israel Standard Time), on the second computer.
