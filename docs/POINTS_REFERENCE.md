# Points reference (מאגר הניקוד) — how it works and how to change it

DEC-035 (2026-09-21). The canonical scoring dataset of the app is derived from
`docs/data/nutrition-points-source.xlsx` (the file Elena provided as `ניקוד.xlsx`).
This page is the operating manual: what the pipeline does, what the app does with
the result, and the exact steps to add or fix a food.

## 1. The three layers (never mixed)

| layer                             | where                                                                                                                             | who writes                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **canonical shared reference**    | `src/data/points-reference/reference.v1.json` (audit) → seeded into `food_reference_items`                                        | the pipeline only (`npm run points:import`) |
| **custom food of Ariel / Elena**  | `foods` row with `points_status = 'confirmed'`, `portion_*`, `created_by_profile_id`                                              | the person, through the new-food form       |
| **snapshot inside a logged meal** | `food_entries`: `food_name`, `amount`, `unit`, `points_value`, `points_basis`, `reference_item_id`, `base_points`, `benefit_rule` | written once when the entry is saved/edited |

Editing a reference row or a custom food **never** rewrites a saved entry
(`pointsForEntry` always prefers the persisted snapshot; proven by
`store-reference.test.tsx` §11 and `migration.pg.test.ts`).

## 2. Pipeline

```
docs/data/nutrition-points-source.xlsx
   │  npm run points:import   (scripts/points-reference/import.ts → src/lib/points-reference/clean.ts)
   ├─► src/data/points-reference/reference.v1.json          audit dataset (verbatim source_* + cleaned fields)
   ├─► src/data/points-reference/reference.v1.runtime.json  bundled runtime projection (no audit columns)
   ├─► src/data/points-reference/import-report.v1.json      counts
   └─► docs/POINTS_REFERENCE_IMPORT_REPORT.md               human report (conflicts, review list)
   │  npm run points:seed
   ├─► supabase/migrations/20260921120000_points_reference.sql   DDL + generated seed block
   └─► supabase/apply_points_reference_production.sql            owner-run wrapper (+ ledger row)
   │  npm run points:reconcile
   ├─► src/data/points-reference/reconciliation.v1.json
   └─► docs/POINTS_REFERENCE_RECONCILIATION.md
```

Everything is deterministic: ids are `sha256(source id | version | row)`, nothing is
timestamped, and `pipeline.test.ts` fails if any checked-in output differs from a
fresh run. Re-running the importer or the seed on the same file changes nothing
(`on conflict (source_id, source_version, source_row) do update`).

### Cleaning rules (codes as they appear in the report)

| code                                                                            | what it does                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `R01_first_four_columns`                                                        | only `מאכל או מנה / כמות / נקודות / שייך לקבוצת מזון` are read; the side table `מה אכלתי` is ignored              |
| `R02_header_row_skipped` / `R03_blank_row_skipped` / `R04_non_food_row_skipped` | repeated headers, empty rows, the title `חוברץ נקודות` and the `A4` marker                                        |
| `R05_exact_duplicate_deprecated`                                                | identical name + quantity + points + category → the later row is `deprecated` with `duplicate_of`                 |
| `R06_conflict_same_name_quantity`                                               | same name + quantity, different points **or** category → every row of the group is `conflict` (never offered)     |
| `R07_category_truncation_fix_חלבון_מהח`                                         | the ONE truncated category `חלבון מהח` (row 566) → `חלבון מהחי`; `source_category` keeps the original             |
| `R08_zero_points_without_quantity_means_any_quantity`                           | `.` / empty quantity **and** 0 points **and** a category → portion `כל כמות` (plain vegetables, tea, spices)      |
| `R09_fruit_allowance_row_attached_to_base_food`                                 | `(במסגרת 3 פירות טריים …` rows attach to the base fruit row with the same portion; they are a benefit, not a food |
| `R10_protein_zero_allowance_conditional`                                        | `תוספת חלבון ב-0 נקודות` rows are conditional; the `0` in the quantity column is the marker, not a measure        |
| `R11_name_whitespace_trimmed`                                                   | only whitespace is normalised in `display_name`; a truncated name is **never** completed by guessing              |

Anything else that is unclear → `needs_review` with a reason code
(`name_truncated`, `quantity_missing_with_points`, `quantity_number_without_unit`,
`quantity_unparsed`, `category_missing`, `benefit_base_food_not_found`,
`benefit_row_with_nonzero_points`). Review rows are imported for audit but are
not search results and never score.

### Search normalisation

Only for matching: spaces, quote variants, punctuation, ktiv male (`יי`→`י`,
`וו`→`ו`) — `normalizeFoodName`. The display name is always the original. Foods
are never merged by fuzzy similarity; the only automatic link is an exact
normalised name (or a verified alias).

## 3. Scoring precedence (`src/lib/points.ts` → `scoreDetails`, `src/lib/points-reference/engine.ts`)

1. **exact** — the chosen reference row and its portion (`reference:exact`);
2. verified alias → same as 1 (aliases live in `food_reference_aliases`; empty in v1);
3. **scaled** — same family only (`reference:scaled`): grams↔grams, ml↔ml, count↔the
   same count label (`כף` only against a `כף` portion; `כוסית`/`קורט`/`צלוחית` only at
   the exact amount); half-point precision, rounded to the nearest 0.5, never to a whole;
4. **blocked** — cup→grams, unit→grams, portion→grams, and any unit the row has no
   explicit measure for. The quantity screen explains why and disables the add;
   nothing is estimated. Raw↔cooked, regular↔light/diet, generic↔brand,
   recipe↔ingredient are different rows by construction and `aliasSafetyIssues`
   refuses an alias across them;
5. a group with several portions is never resolved silently: the app shows the
   variation picker; a favourite/recent chip of such a food opens it too;
6. a custom food with a confirmed value scales the same way (`custom:confirmed`);
7. a built-in catalog food with no reference match keeps the DEC-034 internal model
   (`model:v2-il`) — the basis is stored on the entry and shown on the quantity screen;
8. **0-point rules**: `zero_any_quantity` is the row's own value (0 at any quantity).
   `fruit_daily_allowance` (cap 3/day, from the row text) and `protein_zero_allowance`
   (cap unknown → not provable → never applied) are **benefits**: the entry keeps
   `base_points`, `points_value` becomes the applied value only through
   `benefitEligibility` (per profile-day, each entry counts once, cap enforced).
   The current UI does not apply any benefit; the engine + tests are in place.

## 4. Adding or fixing a food

**A food that is simply missing (the usual case):** use the app. Type the name →
`הוספת “…” כמאכל חדש` → the form asks for reference quantity, unit, category and
points. Similar reference rows are offered as `הצעה לבדיקה` with their source
and confidence; the person confirms. The food is saved once for the household
with `created_by_profile_id` and reused by both from then on.

**Fixing a value or a name in the canonical reference:**

1. Edit the source sheet `docs/data/nutrition-points-source.xlsx` (never the JSON).
2. Bump `SOURCE_VERSION` in `scripts/points-reference/source.ts` (a changed sheet is a
   new version with new row ids; the old rows stay in the database for audit).
3. `npm run points:import` → read `docs/POINTS_REFERENCE_IMPORT_REPORT.md` (new
   conflicts / review rows must be resolved in the sheet, not in code).
4. `npm run points:seed` → regenerates the migration seed block and the production
   wrapper. For a new version add a **new** migration file instead of editing
   `20260921120000` once that one is applied.
5. `npm run points:reconcile` → refresh the catalog reconciliation report.
6. `npm test` — `pipeline.test.ts`, `engine.test.ts`, `migration.pg.test.ts` guard it.
7. Production apply follows `supabase/DEPLOY.md` (owner-run wrapper + read-only verify).

**Resolving a conflict** (`יוגורט טבעי 2.9% שומן -200ג, 2` 4 vs 5; `משקה אורז 1% שומן`
2.5 · משקאות vs 3 · חלבון מהצומח; `רביולי פטריות` 6 · אוכל בחוץ vs 6 · דגנים ופחמימות):
delete the wrong row in the sheet, bump the version, re-run. Until then the food is
hidden from search and can be logged only as a custom food with a confirmed value.

**Linking a catalog food to a reference row by alias** (the review candidates in
`docs/POINTS_REFERENCE_RECONCILIATION.md`): insert a row into
`food_reference_aliases` (`alias`, `normalized_alias`, `item_id`, `verified = true`,
`origin = 'manual'`) through a migration. `aliasSafetyIssues(alias, itemName)` must
return `[]` for it (no raw↔cooked, light/diet or recipe difference). The runtime
alias index (`buildReferenceIndex(dataset, aliases)`) is ready; the app does not
load the table yet (v1 ships no aliases), so wiring `loadAliases` is the first
step when the first alias is added.

## 5. Tests

| file                                                | covers                                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/points-reference/engine.test.ts`           | acceptance 1–8, 13, 14 + parser + suggestions                                                                                             |
| `src/lib/points-reference/pipeline.test.ts`         | acceptance 15 (idempotent importer, seed up to date, counts, cleaning rules)                                                              |
| `src/lib/points-reference/store-reference.test.tsx` | acceptance 9–12 (unknown food, confirmed custom food reuse, immutable snapshot, Ariel/Elena separation)                                   |
| `src/lib/points-reference/migration.pg.test.ts`     | the real SQL on PGlite: DDL, idempotent seed, RLS read-only, owner scope, snapshot survives a reference edit, production wrapper + ledger |
| `src/components/nutrition/PointsReference.test.tsx` | search line, variation picker, blocked unit, new-food confirmation                                                                        |
| `e2e/hermetic/points-reference.spec.ts`             | acceptance 16 — the whole flow on a Pixel 7 viewport, no backend, no horizontal overflow                                                  |
