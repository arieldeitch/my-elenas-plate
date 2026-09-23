# Nutrition App — Claude Run One-Pager

**Run:** RUN_2026-09-23_UNIFIED_POINTS_DISHES_LABEL_ESTIMATOR
**Date:** 2026-09-23
**North Star:** Make daily points tracking practical enough for Ariel and Elena to use continuously, including real home-cooked dishes and packaged products that are not in the reference.
**Current milestone:** One-run delivery of manual target truth + dishes + explicit weight conversion + label-based estimate.

## Project traffic light

| Capability / outcome | Status | What is true now |
|---|---:|---|
| Canonical Weight Watchers/Shomrei Mishkal reference | 🟢 | DEC-036 is implemented in main; new canonical food values come from the imported reference. Live deployment still requires honest verification. |
| Daily target source | 🟡 | Manual override exists, but automatic BMR/personalized calculation can still become the active budget. |
| Reusable dishes | 🔴 | No dedicated dish model/area/points-per-gram workflow. |
| Real grams vs non-weight reference portions | 🔴 | Unsafe unit->gram conversion is currently blocked, but there is no explicit user/label weight bridge. |
| Product not in reference | 🔴 | DEC-036 leaves it unscored; there is no supported estimated-product layer. |
| Nutrition-label estimate | 🟡 | Deprecated transparent `pointsFromNutrition()` machinery exists but is not an active, explicit estimation product flow. |
| Historical points snapshots | 🟢 | Persisted meal snapshots already win and must remain immutable. |
| Two-person household sync | 🟢/🟡 | Shared model exists; new dish/product entities still need equivalent RLS/sync/realtime coverage. |
| Future sex+weight target table | ⚪ | Explicitly future, not this run. |

**Legend:** 🟢 real end-to-end · 🟡 partial/path only · 🔴 required and missing · ⚪ intentionally not this run.

## This run — the move
**Primary objective:** Close all four active RED/AMBER product gaps in one Claude run.

1. Make manual per-profile target the only current budget source.
2. Add dedicated reusable household dishes with final-weight -> points/gram logging.
3. Add explicit reusable weight bridges for non-weight reference portions.
4. Add a separate, clearly marked nutrition-label estimate source for missing products, usable directly and in dishes.

### Explicitly NOT this run
- Future automatic sex+weight target table.
- Proprietary Weight Watchers formula reverse engineering.
- Automatic density/raw-cooked conversions.
- Nested user-created dishes.
- OCR as a dependency for label estimation.
- Any unrelated nutrition dashboard expansion.

## Exit bar
The run succeeds only if:
- all four product capabilities work end-to-end on real app paths;
- manual target never silently falls back to an automatic value;
- canonical and estimated points sources remain visibly/data-model distinct;
- mixed canonical+estimated dishes can be created and logged by grams;
- historical snapshots stay unchanged after editing sources;
- household RLS/sync/realtime tests cover new entities;
- existing DEC-036 behavior remains green;
- build/test/migration gates are green;
- live/production state is reported honestly.

## Focus / anti-drift
`Does the next action directly move one of the active AMBER/RED rows above toward GREEN?`
If no -> park it.

## Run budget
- Wall clock: **no limit by explicit owner decision**.
- Review: one full independent review.
- Remediation: one normal pass; second targeted pass only for P0/P1 defect.
- No endless fresh-review loops.

## Blockers / Ariel action
- **Known blockers:** none for implementation. Production publish/migration may remain an owner-only external gate depending on authenticated access.
- **Expected Ariel action after run:** preferably Nothing; at most one exact production action if external authorization prevents Claude from completing it.
