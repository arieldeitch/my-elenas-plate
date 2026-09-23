# ADR 2026-09-23 — manual target, dishes, weight bridges, label-estimated products

**Status:** accepted (written before the schema was implemented, per the run's process rule)
**Task:** `docs/claude-tasks/RUN_2026-09-23_UNIFIED_POINTS_DISHES_LABEL_ESTIMATOR.md`
**Decision record:** DEC-037 in `docs/decisions.md`

This note records the material architectural choices and the conservative reading of each
ambiguity, so the implementation below is explainable without re-deriving it.

## 1. Manual target is the only budget source (R1)

- `resolvePointsBudget(facts)` returns `{ budget: number | null, source: "manual" | "none" }`.
  There is **no** automatic branch any more: no BMR, no fallback 23/30.
- The DB column stays `profiles.points_budget_override` — the task explicitly allows keeping it
  as the source if that is the safest migration path, and it is: it already syncs, is already
  per-profile, already has RLS, and no migration/backfill is needed. It is only renamed in the
  UI/domain language ("יעד יומי", `manualDailyTarget`).
- `calculatePersonalizedPointsBudget` / `mifflinStJeorBmr` / `ProfileFacts` remain exported and
  tested but are **not reachable from the active budget path**. They are the seam for the future
  sex+weight lookup table (explicitly out of scope): a future run replaces the body of
  `resolvePointsBudget` only.
- `budget === null` is a first-class UI state ("יעד לא הוגדר"). Logging keeps working; nothing
  computes "remaining" against a fake number, and `pointsRemaining` is only called with a number.

## 2. Dishes are a separate derived domain (R2, R8, R9)

Canonical reference tables (`food_reference_items`, `food_reference_aliases`) are **never** written
by this feature (DEC-036 stays intact).

- `dishes` — the *current* definition of a household dish (name, totals, `points_per_gram`,
  optional usual serving, creator, `is_active`, `revision`).
- `dish_versions` — an **immutable** row per revision holding the full ingredient snapshot as
  `jsonb`, plus the totals that were true for that revision.

Why jsonb for ingredients rather than a child table: an ingredient snapshot is write-once, is
always read as a whole with its version, and mixes two source shapes (reference row vs estimated
product) with optional bridge provenance. A jsonb array keeps the snapshot atomic and immune to
later schema drift, which is exactly the property R9 demands; there is no query that needs to
filter dishes by a single ingredient.

Editing a dish writes a **new** `dish_versions` row and bumps `dishes.revision`. A logged meal
entry stores `dish_id` + `dish_revision` + the points it was logged with, so the old serving stays
explainable from its own snapshot even after the dish changes.

## 3. Weight bridges are explicit and never guessed (R4)

`weight_bridges` maps **one unit of one source identity** to grams:
`(household_id, source_kind, source_key, unit) → grams_per_unit` with `provenance` in
(`label`, `user_measured`) and the creator.

- `source_kind = 'reference'` → `source_key` is the reference **group key** and
  `reference_item_id` pins the exact row/variation the bridge was measured on.
- `source_kind = 'estimated'` → `source_key` is the estimated product id.
- A bridge is reusable inside the household for that exact identity only. It is never applied to
  another brand/variant/reference identity, and there is no density inference anywhere.
- Without a bridge, a gram request against a non-weight reference portion stays **blocked** (the
  DEC-036 behaviour) and the UI explains that a bridge is needed.
- The bridge used by a dish ingredient is **copied into the ingredient snapshot**, so later edits
  to the reusable bridge cannot change historical dishes.

## 4. Label-estimated products are a separate source layer (R5, R6, R7)

`estimated_products` is a household-scoped table, disjoint from the canonical reference.

- Input is exactly what the person reads off the package: either per-100 g values or per-serving
  values **plus** the serving weight in grams. Nothing is inferred; a missing optional value is
  treated as 0 contribution and is recorded as absent (not as a measured zero).
- Normalisation is deterministic: per-serving values are scaled to 100 g by
  `value * 100 / serving_weight_g`; the result is scored by the existing transparent linear model
  (`pointsFromNutrition` with `NUTRITION_WEIGHTS_V2`, `STANDARD_PORTION_GRAMS = 100`), so the
  estimator is the *already documented* model, not a new black box, and it is not a claim about
  any proprietary formula.
- Stored: the raw label input, the basis, the normalised per-100 g facts, the resulting
  `points_per_100g`, and `estimator_version = "label-estimate-v1"`.
- DEC-036 deprecated `pointsFromNutrition` as a *canonical fallback*. This ADR re-authorises it
  **only** inside this clearly-marked ESTIMATED layer; the canonical path is unchanged and a
  reference food never falls back to it.
- Everywhere an estimated value appears (search result, quantity screen, meal row, dish
  ingredient, day review) it is labelled `הערכה לפי ערכים תזונתיים` / `הערכה`, and the persisted
  snapshot basis starts with `estimated:` or `dish:` so the distinction survives in data.

## 5. Scoring entry point (R3, R7, R8)

`scoreDetails(entry, food, ctx)` stays the single scoring entry point. It gains two prior
branches, in this order:

1. `entry.dishId` → dish serving: `points = round½(points_per_gram × consumed_weight_g)`,
   basis `dish:weighed` or `dish:estimated` (from `weightSource`).
2. `entry.estimatedProductId` → estimated product: grams are resolved from the entry quantity
   (gram family directly; a non-gram unit needs a bridge on that product, else blocked), then
   `points = round½(points_per_100g × grams / 100)`, basis `estimated:label`.
3. otherwise the unchanged DEC-036 reference path.

Rate precision (`points_per_gram`, `points_per_100g`) is kept in full; the half-point rounding is
applied only at the persisted/logged boundary, matching the existing snapshot convention.

## 6. Sharing, RLS, realtime (R10)

All three new tables follow the existing household pattern exactly: `household_id` +
`is_household_member(household_id)` policies for `authenticated`, no privilege for `anon`,
`set_updated_at` trigger, added to the `supabase_realtime` publication, creator kept in
`created_by_profile_id`. Manual targets stay on `profiles` and remain per-profile — no new
surface can leak one profile's target to the other.

Client-side the new entities hydrate like `foods` (household-wide, not day-scoped) and are pushed
through the existing durable queue as narrow operations (`dish.upsert`, `dish.archive`,
`estimated.upsert`, `bridge.upsert`), each idempotent and keyed by the client-generated uuid, so a
replay after reconnect cannot create a duplicate dish.

## 7. Failing safely before the migration is applied (deploy constraint)

The client probes the new tables once on activation (same pattern as
`foodsSchemaSupportsReferenceLink`). Until they exist, the dishes area and the estimator are
visible but explain that they need the server update, and no write is queued — instead of a
silent queue failure. Everything that worked before keeps working.

## 8. Surface placement (R2, R11)

`/dishes` is a real route (TanStack file route) reachable from the bottom navigation, which grows
from three to four items (בית · תבשילים · הוספה מהירה · יומן). A dish is logged from the meal
editor like any other food, and from the dishes area via "רישום לארוחה". The dish editor keeps the
app's compact mobile language: a short happy path for gram ingredients, the bridge question only
when the chosen portion is not weight-based, and estimated components marked inline.
