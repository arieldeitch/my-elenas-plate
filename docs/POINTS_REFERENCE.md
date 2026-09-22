# Points reference (מאגר הניקוד) — how it works and how to change it

DEC-035 (2026-09-21) + **DEC-036 (2026-09-22)**. The canonical scoring dataset of the
app is derived from `docs/data/nutrition-points-source.xlsx` (the file Elena provided
as `ניקוד.xlsx`). This page is the operating manual: what the pipeline does, what the
app does with the result, and the exact steps to add or fix a food.

## 0. Binding product decision (DEC-036 — project memory)

> **`ניקוד.xlsx` and the points-reference imported from it are the ONLY source of
> truth for the food list and the points values in the app.** Legacy catalog foods
> that existed before the sheet was imported may NOT appear in search, lists,
> favourites, recents or as a default suggestion unless they have a **verified**
> link to an **active** reference row. Meal history is never deleted and historical
> snapshots are never changed.

Consequences, all enforced in code (`src/lib/points-reference/canonical.ts`):

- the active list is built from the reference alone (`resolveCatalog`): one card per
  reference food, one canonical id (`r_<group>`), plus the structured coffee editor;
- a legacy food resolves only by (1) explicit link `foods.reference_group_key`,
  (2) a verified alias in `src/data/points-reference/aliases.v1.json`, (3) an exact
  normalised name — **never** by fuzzy similarity; anything else is hidden (history only);
- `תפוח` (legacy) is a verified alias of `תפוח עץ`: one result, the reference card,
  "נמצא לפי: תפוח" on its secondary line, 100 גרם = 2;
- **every new points value comes from the reference**; there is no category, model,
  manual or estimated fallback. An entry that cannot be resolved is saved **unscored**
  (`points_value = null`, `points_basis = unscored:*`) and shown as "ללא ניקוד";
- a "custom food" is a **personal alias** of a reference food (`PersonalAliasForm`):
  it makes that food findable by the person's own name and takes portion, unit and
  points from it. A name with no matching reference food cannot be saved as a scored
  food — the form says so;
- favourites and recents are resolved through the same resolver: a hidden legacy id
  never comes back, a linked one is shown as its reference card, duplicates collapse;
- editing / stepping a historical entry re-scores through the reference, so it is
  offered only when the entry's food still resolves; otherwise the row says
  "מאכל ישן, לא במאגר" and asks to choose the food again. Copying such an entry is
  never silent: it is saved unscored, not with a legacy value.

The coffee editor (DEC-014) stays and scores through the reference by a documented
map (`coffeeReferenceGroup`): no milk → `אספרסו` (0 at any quantity); regular /
lactose-free milk → `קפוצינו/הפוך 3% שומן`; low-fat → `קפוצינו/ הפוך 1% שומן`; any other
milk (soy, almond, oat, "other") has no reference row → saved unscored, said in the editor.

## 1. The three layers (never mixed)

Since DEC-036 the middle layer holds **personal aliases** only (`reference_group_key` set,
no value of its own). The DEC-035 columns `portion_amount / portion_unit /
points_per_portion / points_status / points_confirmed_at` are no longer written; rows
that hold them are history.

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

**A name the app does not know (the usual case):** type it → `“…” לא במאגר — קישור לשם
אישי` → pick the reference food it means → the name is saved as a personal alias
(`foods.reference_group_key`, `created_by_profile_id`) and the reference food's quantity
screen opens. No value is entered anywhere. If the reference has no such food, nothing
can be saved with points: ask Elena to add a row to the sheet (§ below).

**A legacy catalog name that should show again (e.g. `קוטג׳`):** add a verified alias to
`src/data/points-reference/aliases.v1.json` (`alias`, `target` = the reference display
name, a `note`; `safetyOverride` with a reason when `aliasSafetyIssues` flags it), then
`npm run points:seed` (regenerates the alias seed + wrapper) and
`npm run points:reconcile`. The alias test suite refuses an alias whose target is not a
selectable reference food, a duplicate alias, or a flagged alias without a reason.
Never alias across raw/cooked, regular/light, brand, size or recipe differences — hidden
is the right state for those until Elena decides.

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

**Where aliases live:** the app uses the bundled `aliases.v1.json` (loaded into the
reference index at build time); the same rows are seeded into `food_reference_aliases`
by migration `20260922090000` as the shared audit copy (read-only for the app).

## 5. Tests

| file                                                | covers                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/points-reference/engine.test.ts`           | acceptance 1–8, 13, 14 + parser + suggestions                                                                                                                                                                                                                           |
| `src/lib/points-reference/pipeline.test.ts`         | acceptance 15 (idempotent importer, seed up to date, counts, cleaning rules)                                                                                                                                                                                            |
| `src/lib/points-reference/store-reference.test.tsx` | **DEC-036 acceptance 1–15** (hidden legacy, alias = one card, favourites/recents filtered, personal alias only, scaling, blocked units, half points, hidden statuses, history untouched, copy of an unlinked entry, no duplicates) + alias file validation + coffee map |
| `src/lib/points-reference/migration.pg.test.ts`     | the real SQL on PGlite: DDL, idempotent seed, RLS read-only, owner scope, snapshot survives a reference edit, production wrapper + ledger                                                                                                                               |
| `src/components/nutrition/PointsReference.test.tsx` | search line, variation picker, blocked unit, new-food confirmation                                                                                                                                                                                                      |
| `e2e/hermetic/points-reference.spec.ts`             | acceptance 16 — the whole flow on a Pixel 7 viewport, no backend, no horizontal overflow                                                                                                                                                                                |
