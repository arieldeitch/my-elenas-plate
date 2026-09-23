# RUN 2026-09-23 — unified points, dishes, weight bridges, label estimator (DEC-037)

**Task (binding):** `docs/claude-tasks/RUN_2026-09-23_UNIFIED_POINTS_DISHES_LABEL_ESTIMATOR.md`
(one-pager: `..._ONE_PAGER.md`) · **ADR:** `docs/adr/ADR-2026-09-23-dishes-bridges-estimated.md`
· **Decision:** DEC-037 in `docs/decisions.md`
**Branch:** `feat/unified-points-dishes-label-estimator` (from `main` = `46c1ed8`)

## STATUS: YELLOW

Everything in the task's scope is implemented, reviewed, remediated and green in the repository.
It is **not** live: the DEC-037 migration is not applied to production and the published site still
serves the DEC-036 build. Both are owner-only actions, and both were verified as _not done_ rather
than assumed — see LIVE / DEPLOYMENT. Nothing here is called green on production.

---

## OWNER INTENT TRACEABILITY

| #   | Requirement                                | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Manual daily target is the ONLY source     | GREEN  | `resolvePointsBudget` returns `{budget: number \| null, source: "manual" \| "none"}` — no BMR, no 23/30 fallback (`src/lib/points.ts`). `dec037-engines.test.ts` 1–4 + "a zero or negative stored value is not a target either"; `dec037-store.test.tsx` 1/4/5 and "logging works with no target configured"; `Dec037Flows.test.tsx` 1 + 4. `calculatePersonalizedPointsBudget` / `mifflinStJeorBmr` stay exported and tested but are unreachable from the active path — the documented seam for the future lookup table. |
| R2  | Dedicated dishes area                      | GREEN  | `/dishes` route + a fourth bottom-nav destination (`src/routes/dishes.tsx`, `BottomNav.tsx`): list, search, create, edit as a new revision, archive/restore, "רישום לארוחה". E2E `e2e/hermetic/dishes-and-estimates.spec.ts` walks it on a Pixel 7.                                                                                                                                                                                                                                                                       |
| R3  | Canonical ingredient path unchanged        | GREEN  | `resolveIngredient` step 1 calls the unchanged DEC-036 engine (`resolveReferenceItem`); the reference is never written by this feature. `dec037-engines.test.ts` 6 + 22; `dec037-store.test.tsx` 19 asserts the reference index **and** the active food list are identical after dishes/products/bridges exist.                                                                                                                                                                                                           |
| R4  | Explicit weight bridge, never guessed      | GREEN  | `src/lib/weight-bridges.ts` (`kind:key:unit`), no density inference anywhere; without a bridge a gram request against a non-weight portion stays blocked. `dec037-engines.test.ts` 7/8, "converts only the exact source + unit it was stated for" and "a bridge belongs to the FOOD, so it serves every variation of the same name"; `dec037-store.test.tsx` 8; `Dec037Flows.test.tsx` 7/8. Scope decision documented in ADR §3.                                                                                          |
| R5  | Label estimator, separate ESTIMATED layer  | GREEN  | `src/lib/label-estimator.ts`, `estimator_version = "label-estimate-v1"`, per-100 g or per-serving + serving weight, deterministic normalisation through the already-documented transparent model. `dec037-engines.test.ts` 9/10 + "an absent optional value stays absent" + the refusals; `Dec037Flows.test.tsx` 9/10 + "never fabricates".                                                                                                                                                                               |
| R6  | Estimated products are their own namespace | GREEN  | Separate table, separate id space, separate basis (`estimated:label`), never merged into the reference or the food list (`dec037-store.test.tsx` 19). Every surface marks it: search, quantity screen, meal row, day review, dish ingredient, dish card.                                                                                                                                                                                                                                                                  |
| R7  | Mixed dishes (canonical + estimated)       | GREEN  | `dec037-engines.test.ts` 13; `dec037-store.test.tsx` 19 builds one; the E2E builds a mixed dish and asserts the estimated ingredient stays marked.                                                                                                                                                                                                                                                                                                                                                                        |
| R8  | Final weight → points/gram → serving       | GREEN  | `points_per_gram = total / final_weight_g` at full precision, half-point rounding only where a meal entry is persisted. `dec037-engines.test.ts` 14, 15/16 and "the weight SOURCE is what distinguishes the two snapshots"; `dec037-store.test.tsx` 15/16.                                                                                                                                                                                                                                                                |
| R9  | Historical snapshot integrity              | GREEN  | Entries keep `points_value` + `dish_revision` + provenance; `dish_versions` is immutable and now **append-only in the database** (no update/delete grant, no update/delete policy). `dec037-store.test.tsx` 17 + 18 (the whole snapshot is compared, not just the value); `dec037-migration.pg.test.ts` "a new revision is a NEW immutable version row…" (incl. a refused UPDATE and DELETE) and the meal-provenance test.                                                                                                |
| R10 | Household sharing, RLS, realtime           | GREEN  | The same household pattern as every existing table (`is_household_member`, `authenticated` only, nothing for `anon`, realtime publication). `dec037-migration.pg.test.ts` incl. acceptance 20 cross-household negatives; `src/lib/sync/multi-device.test.tsx` → "dishes / estimated products / bridges sync (DEC-037 R10)" and "manual daily target — isolation, realtime and no automatic value".                                                                                                                        |
| R11 | UX / mobile                                | GREEN  | Hebrew RTL, phone-first, one action per screen; estimates and dish servings are labelled everywhere they appear; the E2E asserts no horizontal overflow at Pixel 7 width. A dish serving / estimated entry is never shown as "מאכל ישן, לא במאגר".                                                                                                                                                                                                                                                                        |

### Acceptance scenarios 1–25

- **1–5** manual target → `dec037-engines.test.ts` 1–4, `dec037-store.test.tsx` 1/4/5, `Dec037Flows.test.tsx` 1 + 4.
- **6** dish from three canonical gram ingredients → `dec037-store.test.tsx` 6, `Dec037Flows.test.tsx` 6/14.
- **7, 8** bridge / blocked without one → `dec037-engines.test.ts` 7/8, `Dec037Flows.test.tsx` 7/8.
- **9, 10** per-100 g and per-serving labels → `dec037-engines.test.ts` 9/10, `Dec037Flows.test.tsx` 9/10.
- **11** partner reuse → `dec037-store.test.tsx` 9/11/12 + the multi-device sync test.
- **12** logging an estimate with provenance → `dec037-store.test.tsx` 9/11/12, `Dec037Flows.test.tsx` 5/12.
- **13** mixed dish → `dec037-engines.test.ts` 13. **14** deterministic rate → `dec037-engines.test.ts` 14.
- **15, 16** weighed vs estimated serving → `dec037-engines.test.ts` 15/16, `dec037-store.test.tsx` 15/16.
- **17, 18** edit invariants → `dec037-store.test.tsx` 17 + 18.
- **19** canonical tables untouched → `dec037-store.test.tsx` 19 (reference index **and** the active food list identical).
- **20** RLS negatives → `dec037-migration.pg.test.ts` 20. **21** realtime / multi-device → `multi-device.test.tsx`.
- **22** DEC-036 behaviour unchanged → `dec037-engines.test.ts` 22 and the whole pre-existing suite still green.
- **23** gates → below. **24** SQL ↔ generated types → `src/lib/supabase/dec037-schema-parity.test.ts`.
- **25** mobile E2E → `e2e/hermetic/dishes-and-estimates.spec.ts`.

---

## ENGINEERING GATE

- **migrations/RLS** — `supabase/migrations/20260923090000_dishes_bridges_estimated.sql`: four new
  tables plus five NULLABLE columns on `food_entries`; additive, idempotent, forward-only, rollback
  documented in the file. Household RLS identical to the existing tables; `anon` has nothing;
  `dish_versions` is append-only (select + insert only, no update/delete grant or policy). Proven
  on PGlite against the real SQL — no Docker, no local Supabase stack (repo policy honoured).
  Owner artefacts: `supabase/apply_dishes_bridges_estimated_production.sql` (single transaction,
  BEFORE/AFTER counts, ledger row) and `supabase/verify_dishes_bridges_estimated.sql` (read-only,
  10 sections), both regenerated after the append-only change; runbook in `supabase/DEPLOY.md`.
- **tests** — `bun run test`: **53 files, 508 passed, 16 skipped** (the 16 are the pre-existing
  environment-gated ones). Hermetic Playwright: **10/10** on mobile-chrome.
- **typecheck/lint/build** — `tsc --noEmit`: 0 errors. `eslint .`: 0 errors, 9 warnings — all
  pre-existing `react-refresh/only-export-components`. `vite build`: OK.
- **sync/realtime** — narrow idempotent ops (`dish.upsert`, `dish.archive`, `estimated.upsert`,
  `bridge.upsert`) through the existing durable queue; realtime cases for the four tables;
  hydration never overwrites a row whose write is still queued. The activation network budget is
  unchanged in kind (20 reads including the three household-wide DEC-037 reads, which double as the
  schema probe — no extra round trip).
- **security/secret scan** — repository scan for `service_role` / `sb_secret_` / JWT material:
  clean (only the preflight scanner's own patterns match). `.env.production` is the tracked PUBLIC
  publishable key, as before. `preflight --live` → `secrets:live` PASS.
- **commit/PR/main SHA** — branch `feat/unified-points-dishes-label-estimator` on `main = 46c1ed8`:
  `2da090f` (ADR) → `824aedd` → `b12b298` → `54c1307` → `e56f743` → `7320c25` → `b27e6a8` (review
  remediation) → `c243bea` (acceptance 24 as a test) → this report. PR opened against `main`.

---

## PRODUCT GATE

- **manual target** — one number the person types; no invented value anywhere. "יעד לא הוגדר" is a
  real state: logging keeps working, there is no denominator and no fake "remaining".
- **dedicated dishes** — a fourth destination in the bottom navigation with its own list, editor,
  archive and "log a serving"; a dish is also searchable from inside a meal.
- **weight bridge** — asked once, in the person's words ("1 כף = כמה גרם?"), stored per food + unit
  with its provenance and reused afterwards; never inferred, never applied to another food.
- **label estimator** — type what the package says; the estimate is always labelled
  "הערכה לפי ערכים תזונתיים" and carries `label-estimate-v1` in the data.
- **mixed-source dish** — canonical and estimated ingredients coexist; the dish and every serving
  logged from it is marked as containing an estimate.
- **serving logging** — by weight, weighed or estimated, distinguishable in the snapshot; the usual
  serving is one tap.
- **partner visibility** — dishes, products and bridges are household-wide and arrive on the other
  phone through realtime; the daily target stays strictly per profile.
- **history invariants** — editing a dish or a product never changes a meal that was already
  logged; the revision it was logged from is recorded, and the version row cannot be rewritten.

---

## LIVE / DEPLOYMENT

**Actually deployed and verified: nothing from this run.** Verified now, not assumed:

- `bun run preflight -- --live`: 13 PASS, 1 FAIL, 1 MANUAL. The FAIL is `sha` — the published site
  serves `dc151ad` (DEC-036, built 2026-09-22) while `main` is `46c1ed8`. That gap is the two
  docs-only commits already on `main`; it predates this run, and nothing from this branch is
  published.
- Production REST probe with the public anon key (read-only, project `rqgoiuztphkcvbwtbxbj`):
  `dishes`, `dish_versions`, `estimated_products`, `weight_bridges` → HTTP 404 `PGRST205` (the
  tables do not exist); `food_reference_items`, `food_entries` → HTTP 401 `42501` (they exist and
  RLS refuses anon, as designed). **The DEC-037 migration is NOT applied.**

**Only merged / only in the repository:** the whole DEC-037 implementation, its tests, the
migration and the owner apply + verify scripts, the ADR, and the DEPLOY / status / context / todo
updates.

**Pre-migration safety (required by the task):** the published client must keep working before the
tables exist, and it does. The three household-wide reads issued on activation _are_ the schema
probe; a missing relation (`PGRST205` from PostgREST or SQLSTATE `42P01`) switches the feature to
"needs the server update", the dishes area and the estimator say so, and **no write is queued** —
so nothing can be quarantined by a doomed operation. Detection of `PGRST205` was found and fixed
during this run's own live verification (`7320c25`), with a regression test.

**Exact remaining external gate:** one owner action — see ARIEL.

---

## REVIEW BUDGET

- **Review rounds:** 1 independent review after implementation, against this task's traceability
  (R1–R11 and the 25 acceptance scenarios), as the budget allows.
- **Remediation cycles:** 1. The verdict was FIX-FIRST: one P1 and eleven P2s, all fixed in
  `b27e6a8` (plus `c243bea` for acceptance 24).
  - **P1** — a duplicate dish name was accepted locally and then refused permanently by the unique
    index (23505 → quarantine), taking its logged servings with it (23503); in cloud mode, where
    localStorage is not a source of truth, both disappeared on the next reload. It is now refused
    up front, archived dishes included, with a message that offers the real choices.
  - **P2s** — `dish_versions` was mutable by policy; hydration could clobber unsent local writes;
    dish / estimated entries were shown as "old food, not in the database"; ingredient grams used
    the primary measure even when an alternative matched; the dish log sheet stayed mounted and
    kept stale state; editing an archived dish un-archived it; `isEstimatedBasis` also returned
    true for a weighed dish serving; the demo snapshot did not carry dishes / products / bridges or
    the manual target; the search said "nothing found" while listing household results; the ADR
    described a bridge scope the code does not implement; acceptance 19 was under-asserted; and
    acceptance 24 was a one-off script rather than a test.
- **Second targeted remediation:** not used — no P0/P1 remained after the first pass.
- **Stalls:** none that blocked progress. Two self-inflicted detours worth recording: a
  `String.replace` patch collapsed `$$` in the migration's `do $$` blocks (caught immediately by
  the three PGlite suites, repaired, all green), and the remediation script aborted midway on a
  stale anchor after a formatting pass, so the remainder was applied file by file.
- **Why the loop stopped:** the full required gate is green, the single review round and its one
  remediation pass are spent per the task's budget, and everything that remains is an owner-only
  action that cannot be performed — or faked — from here.

---

## ARIEL

**One bounded action — apply the migration, then publish.** In the Supabase Dashboard SQL Editor of
project `rqgoiuztphkcvbwtbxbj` (owner account):

1. run `supabase/verify_dishes_bridges_estimated.sql` and keep §1's counts;
2. run `supabase/apply_dishes_bridges_estimated_production.sql` (one transaction; it prints the same
   counts BEFORE and AFTER and records `20260923090000` in the ledger);
3. run the verify script again — §1 identical · §2 four tables with RLS · §3 14 policies · §4 no
   `anon` row · §5 five nullable columns · §6 four realtime tables · §7 the new tables empty ·
   §8 unchanged basis distribution · §10 the ledger row;
4. publish `main` from Lovable, then `npm run preflight -- --live` (the `sha` check turns PASS).

Until step 1 is done nothing breaks: the app keeps working exactly as today, and the dishes area
explains that it is waiting for the server update.

Afterwards, in the app itself: each person enters their daily target once (יעד יומי) — there is no
automatic value, by design.
