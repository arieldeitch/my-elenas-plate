# Run record — 2026-09-21 (thirteenth run) — canonical points reference from `ניקוד.xlsx`

**Objective:** turn Elena's points sheet (`ניקוד.xlsx`, saved as
`docs/data/nutrition-points-source.xlsx`, sha256 `e58501087865a0a8841376c06ed309bad86ba4fd1163ac91d60740eef6658ac4`)
into the canonical scoring reference of the app end to end: cleaned, versioned, provenance-preserving
dataset; migration + seed; resolution engine with safe conversions only; search/quantity/new-food UX;
reconciliation with the existing catalog; the 16 mandatory acceptance tests. Prompt:
`RUN_2026-09-21_POINTS_REFERENCE.prompt.md`. Decision: **DEC-035**. Manual: `docs/POINTS_REFERENCE.md`.

**Outcome:** repository `GREEN` on every gate (typecheck, lint 0 errors, vitest 435 passed, hermetic
Playwright 9/9 incl. the new phone-width spec, production build); migration `20260921120000` prepared,
proven on a real Postgres (PGlite) and **NOT applied to production** (owner action, see §Deployment);
branch `feat/points-reference-import` pushed, PR opened, **no merge to `main`**.

## A. System check

- OS alignment: `OS_ALIGNMENT_RECEIPT.md` read. No Control Tower token on this machine → **OS sync not
  re-verified**; no receipt recorded (the script does nothing without a token). Reported as such.
- `main` = `origin/main` `b855a67` (PR #1 merged); work branch `feat/points-reference-import` created from it.
- Supabase project `rqgoiuztphkcvbwtbxbj`: the MCP account (Noris workspace) cannot see it (checked once,
  as memory records); no `.env.e2e` / test-branch credentials on this machine. Consequence: DB proof is
  hermetic (PGlite over the real migration SQL), production apply is an owner action.
- No Docker, no `supabase start`, no local stack (`docs/NO_LOCAL_DOCKER_POLICY.md`).
- Baseline before any change: typecheck 0 · vitest 396 passed / 16 skipped · lint 0 errors.

## B. Source facts (verified by the importer, `docs/POINTS_REFERENCE_IMPORT_REPORT.md`)

1,401 sheet rows → 4 repeated headers, 1 blank, 2 non-food (`חוברץ נקודות`, `A4`) → **1,394 food rows**,
**1,242 distinct source names** (1,240 search keys), 130 names with variations, points all integer or
half (1,208 / 186 / 0 other). Categories as listed in the prompt, plus the truncated `חלבון מהח` (1 row)
and 13 rows without a category.

## C. What changed (code)

- `src/lib/points-reference/` — `types.ts`, `quantity-parse.ts` (130 quantity shapes), `clean.ts`
  (rules R01–R11, conflicts, duplicates, benefit attachment, report), `engine.ts` (resolution,
  benefits, alias safety, suggestions), `index.ts` (runtime index, groups, `withReference`).
- `src/lib/points.ts` — `scoreDetails` / `scoreEntry(entry, food, ctx)`: reference row → confirmed
  custom portion → v2-il; `pointsForEntry` never estimates a reference-linked entry.
- `src/lib/domain.ts` — `Food.referenceGroupKey / portionAmount / portionUnit / pointsStatus / createdBy`;
  `FoodEntry.pointsBasis / referenceItemId / basePoints / benefitRule`.
- `src/lib/store.tsx` — derived searchable catalog (`withReference`), `addFood(name, category, details)`,
  benefit eligibility context on add/edit.
- Data layer — `database.generated.ts` (3 tables, 10 columns), `mappers.ts`, `repositories.ts`,
  `supabase-sync.ts` (creator profile id on custom foods).
- UI — `FoodSearch` secondary line (`portion · points · category`, or `N כמויות · range`), recents/favourites
  first inside a tier; `VariantPicker`; `QuantitySelector` reference-aware (portion prefilled, resolvable
  units, blocked message + disabled add, basis label); `NewFoodForm` (confirmation, `הצעה לבדיקה`).
- Pipeline scripts `scripts/points-reference/*` + npm scripts `points:import`, `points:seed`,
  `points:reconcile`; dev dependency `xlsx@0.18.5`.
- Migration `supabase/migrations/20260921120000_points_reference.sql`, generated wrapper
  `supabase/apply_points_reference_production.sql`, read-only `supabase/verify_points_reference.sql`.

## D. Import results

|                                           |                           |
| ----------------------------------------- | ------------------------: |
| rows read                                 |                     1,401 |
| rejected (headers / blank / non-food)     |                         7 |
| imported                                  |                 **1,394** |
| merged as exact duplicates (`deprecated`) |                         2 |
| conflicts (`conflict`)                    |         6 rows / 3 groups |
| `needs_review`                            |                        78 |
| **active**                                |                 **1,308** |
| benefit rows attached to a base food      | 39 (34 fruit + 5 protein) |
| benefit rows without a base (review)      |                         9 |

Review reasons: name truncated 32 · quantity missing with points 29 · category missing 11 · benefit base
not found 9 · number without unit 7 · benefit with non-zero points 1. The two declared conflicts were
found exactly as described (yogurt 4/5; rice drink 2.5 משקאות / 3 חלבון מהצומח); a third
(`רביולי פטריות`, same 6 points, different category) was marked too.

## E. Reconciliation with the existing catalog (`docs/POINTS_REFERENCE_RECONCILIATION.md`)

390 built-in foods → **78 linked automatically** (exact normalised name), **158 review candidates**
(similar name, listed with alias-safety issues, NOT linked), **153 unmatched** (stay on v2-il).
Active reference groups 1,120, of which 78 claimed by catalog foods; the other 1,042 are searchable
reference-only foods (`r_*` ids, never written to `foods`).

Deliberate behaviour changes for linked foods (new entries only): `תפוח אדמה` 200 g = 4 (was 0 as a
vegetable), `בטטה` 2, `בננה` 100 g = 2 (was 1/portion), `זיתים` two portions → picker, etc.

## F. Tests (evidence)

| gate                                                   | result                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                                                                                                                                                                                                                             |
| `npx eslint .`                                         | 0 errors (9 pre-existing fast-refresh warnings)                                                                                                                                                                                                      |
| `npx vitest run`                                       | **435 passed / 16 skipped** (was 396) — new: `engine.test.ts` 16, `pipeline.test.ts` 5, `store-reference.test.tsx` 5, `migration.pg.test.ts` 9, `PointsReference.test.tsx` 4; `MealEditor.test.tsx` custom-food case ported to the confirmation flow |
| `npx playwright test -c playwright.hermetic.config.ts` | **9 passed** (8 existing + `points-reference.spec.ts` on Pixel 7, no horizontal overflow)                                                                                                                                                            |
| `bun run build`                                        | OK; client `index.js` gzip 197 KB → 270 KB (runtime dataset)                                                                                                                                                                                         |
| `npm run points:import` ×2                             | second run "up to date" on all four outputs                                                                                                                                                                                                          |

Mapping of the 16 mandatory items → `docs/POINTS_REFERENCE.md §5`.

## G. Data safety

No row of `foods`, `food_entries`, meals, preferences or history is deleted or rewritten. Every new
column is nullable/defaulted. Historical snapshots keep `points_value` and get no provenance until a
deliberate edit. Reference edits never touch entries (PGlite + store tests). Conflict rows are never a
default and never overwrite user data. RLS: reference tables SELECT-only for authenticated, nothing for
anon; household tables unchanged. Rollback statements are in the migration header.

## H. Deployment gate (STOPPED here, by design)

1. Owner runs `supabase/verify_points_reference.sql` (read-only) on `rqgoiuztphkcvbwtbxbj` — BEFORE.
2. Owner runs `supabase/apply_points_reference_production.sql` (one transaction, idempotent, ledger row).
3. Owner runs the verify script again: 3 tables with RLS, 1,394 rows (1,308/78/6/2), 10 new columns,
   ledger `20260921120000`, household counts unchanged.
4. Merge the PR to `main` (Lovable's connected branch) → Lovable publish → `npm run preflight -- --live`.
   The client tolerates the missing columns for reads; **writes of custom foods with a confirmed value
   and entries with provenance need the migration first** → apply before publishing.

Not done in this run: production apply, merge, publish (no owner access from this session; gates per
`supabase/DEPLOY.md`).
