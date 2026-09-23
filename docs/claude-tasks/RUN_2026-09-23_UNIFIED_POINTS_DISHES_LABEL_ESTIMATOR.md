# RUN 2026-09-23 — Unified Points Target, Dishes, Weight Bridges & Label Estimator

## Authority
Owner-approved implementation task. Execute this entire scope in ONE Claude/Claude Code run.

Canonical product intent is also mirrored in Drive, but execution MUST use repo-local sources only.

## Primary objective
Turn the current reference-only food application into a practical daily system that:
1. uses a manually entered per-profile daily points target as the current source of truth;
2. supports reusable household dishes in a dedicated area;
3. supports explicit gram bridges between reference portions and actual weighed ingredient amounts;
4. supports a clearly labeled deterministic points ESTIMATE for products not found in the canonical reference, based on manually entered nutrition-label values.

This is one coherent milestone. Do not split it into separate future runs merely because the implementation is broad.

## Owner run-budget decision
- Wall clock: UNBOUNDED. Do not stop because the run is long.
- Review budget: one independent/full review after the implementation pass.
- Remediation budget: one normal remediation pass; a second targeted remediation is allowed only for a remaining/new P0/P1 correctness, security, RLS, data-integrity or core-product acceptance defect.
- After remediation use delta-scoped verification, not another open-ended full-history review.
- Terminal success: implementation + tests + migration safety + product acceptance evidence are green, with any production-only action explicitly isolated.
- Terminal escalation: only a genuine external/owner-only gate, missing credential, irreversible production approval, or unavailable external infrastructure. Minor ambiguity is NOT a reason to stop; make a conservative product-aligned choice and document it.

## Mandatory preflight
1. `git status`; do not overwrite unrelated work.
2. fetch/pull latest `origin/main`; record exact SHA.
3. read:
   - `docs/POINTS_REFERENCE.md`
   - `docs/decisions.md` (especially DEC-034/035/036)
   - `docs/NO_LOCAL_DOCKER_POLICY.md`
   - `src/lib/points.ts`
   - `src/lib/points-config.ts`
   - `src/lib/domain.ts`
   - `src/lib/store.tsx`
   - `src/components/nutrition/PointsBudgetEditor.tsx`
   - `src/components/nutrition/QuantitySelector.tsx`
   - current Supabase schema/migrations/RLS/repositories/mappers/sync tests.
4. inspect current route/navigation structure before choosing the dishes surface.
5. verify current DEC-036 production/live state using existing repo preflight/read-only methods where possible. Do not falsely claim live state. A production-only owner gate must not erase or contract this implementation scope.
6. Never start Docker, `supabase start`, Testcontainers, or a local self-hosted Supabase stack.

## Requirement traceability — binding

### R1 — Manual daily target is current source of truth
Current behavior is wrong for the newly clarified requirement because `resolvePointsBudget()` can derive a BMR-based automatic target.

Implement:
- the manually entered per-profile target is the ONLY effective daily budget source;
- the existing `points_budget_override` may remain the DB source if that is the safest migration path;
- `calculatePersonalizedPointsBudget` / BMR logic may remain for historical/reference reasons but MUST NOT determine the active budget;
- no fallback 23/30/personalized target when manual target is null;
- if no target exists, meal logging still works and the Today/summary UI says the target is not configured instead of calculating remaining/overrun against a fake number;
- Settings/profile UI makes manual target simple and primary;
- sex/birth-date/height/goal/weight may remain stored but are not required to calculate the current target;
- future sex+weight lookup is deliberately out of scope; preserve an architecture seam for it.

Tests:
- manual target = exact effective target;
- changing weight does not change effective target;
- changing sex/profile facts does not change effective target;
- target null never resolves to 23/30/automatic;
- Ariel/Elena targets remain isolated;
- realtime profile update refreshes only the intended profile.

### R2 — Dedicated dishes area
Create a dedicated Hebrew RTL user-facing "תבשילים" area for:
- list/search existing household dishes;
- create;
- edit;
- archive/delete only if safely supported by current product semantics;
- start logging a dish into a meal.

Exact route/navigation placement is your architectural choice after inspecting the app, but it must feel like a real first-class area, not a buried form.

A dish is a separate derived domain entity. Do NOT write dishes into `food_reference_items` or aliases.

Recommended data shape (adapt if the existing architecture has a better equivalent):
- `dishes`: id, household_id, name, current_version/revision, total_points, final_weight_g, points_per_gram, usual_serving_weight_g nullable, created_by_profile_id, active, timestamps.
- immutable/versioned ingredient snapshot rows or a version table so historical calculation remains explainable.
- ingredient rows with source type and snapshot fields.
Choose a schema that preserves history cleanly and works with the existing household/RLS/realtime model.

### R3 — Preferred canonical ingredient path
Inside dish creation, the preferred ingredient path is the existing canonical reference catalog.

For each chosen reference ingredient:
- preserve exact reference identity/version/variation;
- choose an explicit supported reference quantity;
- use the current deterministic reference engine for points;
- no fuzzy match and no hidden legacy fallback.

### R4 — Explicit weight bridge
Support real-world weighed grams even when the reference basis is a spoon/cup/unit/serving.

Rules:
- weight-based reference portion -> scale directly using existing safe logic;
- non-weight reference portion -> require an explicit bridge, never guess density;
- bridge example: `1 כף = 15 גרם`;
- bridge provenance: `label` or `user_measured`;
- permit safe household reuse for the exact source/reference identity;
- do not automatically share a bridge across brand/variant/reference identities;
- without a bridge, gram conversion remains blocked and UI explains what is needed.

Data model may use a reusable `weight_bridges` table/entity plus an immutable snapshot copied into the dish ingredient.

Tests must include:
- direct 100g reference scaling;
- tablespoon->grams with a 15g explicit bridge;
- same ingredient without bridge is blocked rather than guessed;
- bridge for one variant is not silently applied to another.

### R5 — Nutrition-label estimator for missing products
Provide a reusable "הערכת מוצר מלייבל" flow from:
1. dish ingredient not-found path;
2. normal food search/not-found path.

Input:
- user manually types nutrition values from the package label;
- support per-100g;
- support per-serving + serving weight grams;
- normalize deterministically to a gram basis.

Use/extend the existing `NutritionFacts` + `pointsFromNutrition()` path. Do NOT create an unrelated black-box estimator and do NOT claim a proprietary WW formula.

The estimator must:
- use real user-entered label facts only;
- clearly display `הערכה לפי ערכים תזונתיים`;
- have a model/version such as `label-estimate-v1`;
- persist the exact input facts/basis used;
- document the formula/weights and how missing optional values are handled;
- never fabricate missing nutrition values;
- produce a reusable household estimated product;
- normalize per-serving labels to grams when serving weight is known;
- make the output distinguishable from canonical reference points everywhere it appears.

The existing nutrition model was deprecated only as a canonical fallback by DEC-036. This task explicitly re-authorizes it ONLY as a separate ESTIMATED source layer.

### R6 — Estimated product is a separate namespace/source
Do not pollute:
- `food_reference_items`;
- `food_reference_aliases`.

Create a clean domain/data representation such as `estimated_product` / `estimated_foods` or an equivalent explicit source discriminator.

An estimated product:
- belongs to the household;
- preserves creator;
- is reusable by both Ariel and Elena;
- can be logged directly;
- can be selected as a dish ingredient;
- is visibly estimated;
- persists estimator version + nutrition input snapshot + normalized points basis.

### R7 — Dishes may mix canonical and estimated ingredients
Allow a dish to combine:
- reference ingredients;
- label-estimated products.

For every ingredient snapshot preserve:
- source type;
- source/reference id and source version when applicable;
- user-visible name;
- reference quantity or estimated-product gram basis;
- actual amount used;
- explicit bridge used, if any;
- points contributed;
- estimator provenance for estimated products.

The dish UI must indicate when any component is estimated.

### R8 — Final dish weight and serving logging
Dish total:
`total_dish_points = sum(ingredient_points)`

Require final prepared dish weight in grams:
`points_per_gram = total_dish_points / final_prepared_weight_g`

Logging:
`logged_points = points_per_gram * consumed_weight_g`

Support:
- actual weighed serving grams;
- user-entered estimated grams, explicitly marked as estimated;
- optional saved usual serving grams as a shortcut.

Keep underlying rate precision; apply existing half-point/display semantics only at the correct persisted/logging boundary after reviewing current snapshot conventions.

### R9 — Historical snapshot integrity
Non-negotiable:
- a logged meal snapshot never changes because a dish, estimated product, weight bridge or reference row changes later;
- editing a dish creates/recomputes current definition/version only;
- old dish log remains explainable from its persisted snapshot;
- changing estimated product nutrition later does not rewrite previous dishes/meals;
- no backfill/recalculation of production meal history.

Add regression tests proving this.

### R10 — Household sync / RLS / realtime
All new household entities must follow the real two-person shared model:
- household-scoped RLS;
- authenticated member access consistent with current policies;
- creator identity retained;
- realtime or existing sync mechanism updates partner/device;
- no profile leakage for manual targets;
- no duplicate dish creation during hydration/replay.

Add generated types/mappers/repositories/sync operations and tests as required by the current architecture.

### R11 — UX
- Hebrew RTL.
- Compact first view; detail on tap.
- Happy path for a known gram-based ingredient is short.
- Show weight bridge only when necessary.
- Canonical = normal trusted reference language.
- Estimated = explicit but non-alarmist "הערכה".
- No spreadsheet-style mobile form.
- Preserve accessibility / keyboard-safe behavior already used by the app.
- A user must be able to create and later log a dish without understanding internal provenance terms.

## Explicit non-goals
- future weight+sex budget lookup table;
- reverse engineering Weight Watchers;
- OCR/photo label capture (unless existing infrastructure makes it trivial; manual label entry is mandatory and sufficient);
- density guessing;
- fuzzy canonical matching;
- automatic raw/cooked conversion;
- nested user-created dishes;
- rewriting historical entries;
- new unrelated nutrition dashboards/macros features.

## Migration / deploy constraints
- additive, forward-safe migrations;
- preserve existing production data and RLS invariants;
- client must fail safely if new schema is not yet present;
- use hosted/CI/hermetic verification according to repo policy; no local Docker;
- if production migration/application requires owner-only credentials, produce an exact apply + verify wrapper/runbook and leave ONE bounded owner action;
- do not call the product live/green until runtime verification actually proves it.

## Required acceptance scenarios
At minimum automate or explicitly verify:
1. target 27 entered manually -> effective budget 27.
2. new weigh-in does not change 27.
3. sex/profile-fact edit does not change 27.
4. no target -> "יעד לא הוגדר", logging still works, no fake remaining value.
5. partner target does not leak.
6. create dish from 3 canonical gram-based ingredients.
7. canonical non-weight ingredient + explicit `1 כף = 15g` bridge.
8. same gram request without bridge is blocked.
9. missing packaged product -> enter per-100g label -> estimated points.
10. per-serving label + gram serving -> normalized estimate.
11. save estimated product -> partner can see/reuse.
12. log estimated product directly -> snapshot provenance retained.
13. create mixed dish (reference + estimated).
14. save final prepared weight -> deterministic points/gram.
15. log actual 250g serving.
16. log estimated 250g serving -> distinguishable snapshot.
17. edit dish -> old logged serving points unchanged.
18. edit estimated product -> old dish/meal snapshots unchanged.
19. canonical reference tables unchanged by dishes/estimated products.
20. RLS negative tests prevent cross-household access.
21. realtime/multi-device test proves shared dish/product propagation without target leakage.
22. existing DEC-036 reference search, aliases, favourites/recents and quantity blocking remain green.
23. typecheck/lint/unit/integration/build/secret checks green.
24. migration SQL and generated types match.
25. mobile-sized E2E/smoke demonstrates dedicated dishes flow.

## Implementation process
1. Create a feature branch from current main.
2. Write a short architecture note/decision in repo BEFORE schema implementation if a material choice is needed.
3. Implement vertically: schema/domain -> deterministic engines -> repositories/sync -> UI -> tests.
4. Keep the app runnable after each coherent commit.
5. Run the full relevant suite.
6. Perform one independent review against THIS task's traceability, not a generic code review.
7. Remediate material findings within the budget above.
8. Re-run delta + full required gates.
9. Push branch and open/update PR.
10. Merge only when repository policy/checks allow and the pre-migration client remains safe. If merge/deploy needs an owner gate, do not fabricate completion.
11. Produce `docs/claude-runs/RUN_2026-09-23_UNIFIED_POINTS_DISHES_LABEL_ESTIMATOR_REPORT.md`.

## Final report format
STATUS: GREEN / YELLOW / RED

OWNER INTENT TRACEABILITY
- R1 ... R11: GREEN / YELLOW / RED + evidence

ENGINEERING GATE
- migrations/RLS
- tests
- typecheck/lint/build
- sync/realtime
- security/secret scan
- commit/PR/main SHA

PRODUCT GATE
- manual target
- dedicated dishes
- weight bridge
- label estimator
- mixed-source dish
- serving logging
- partner visibility
- history invariants

LIVE / DEPLOYMENT
- what is actually deployed and verified
- what is only merged
- exact remaining external gate, if any

REVIEW BUDGET
- review rounds
- remediation cycles
- stalls
- why the loop stopped

ARIEL
- Nothing, or ONE exact bounded action only.
