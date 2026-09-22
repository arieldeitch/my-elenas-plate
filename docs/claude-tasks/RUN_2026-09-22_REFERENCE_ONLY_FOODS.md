# Run record — 2026-09-22 (fourteenth run) — the points reference becomes the ONLY source of the food list

**Objective (3-hour window):** make the points-reference the single source from which the active
food list is built: hide legacy catalog foods without a verified link, collapse duplicates through
verified aliases (the mandatory example: legacy `תפוח` → reference `תפוח עץ`), remove every points
fallback, turn custom foods into personal aliases of reference foods, keep history untouched.
Decision: **DEC-036** (binding product decision recorded in `docs/POINTS_REFERENCE.md §0` and
`docs/decisions.md`).

**Outcome:** repository `GREEN` on every gate; migration `20260922090000_reference_only_foods`
prepared, proven on PGlite (both wrappers in order, before/after counts identical, idempotent);
branch `feat/reference-only-foods` → PR merged to `main` per the run's mandate (gates passed).
**Not done by this session (no owner access):** production apply of `20260922090000` and the Lovable
publish — see §Deployment. Drive project memory: no P-005 document exists in the connected
Drive (only the Sevev OS pilot) → **not updated in Drive**, gap documented.

## A. System check

- `main` = `origin/main` `919f75e` = **live**: `npm run preflight -- --live` → `PREFLIGHT PASS — 14
checks`, served sha `919f75e` (PR #2 merged 2026-09-22 03:38Z and published by the owner).
- Production DB: read-only REST probe with the public anon key → `food_reference_items` answers
  `42501 permission denied for table` (not "relation does not exist") → migration `20260921120000`
  **is applied** in production. The MCP Supabase account still cannot see `rqgoiuztphkcvbwtbxbj`.
- Docs read: `docs/POINTS_REFERENCE.md`, both reports, DEC-035, `RUN_2026-09-21_*`, `supabase/DEPLOY.md`.
- OS alignment: receipt pointer read; no Control Tower token on this machine → OS sync not re-verified.
- No Docker, no local stack. Baseline on `main`: typecheck 0 · lint 0 errors · vitest 435 / 16 skipped.

## B. What changed

- **Canonical resolver** `src/lib/points-reference/canonical.ts`: `isSelectableItem` (active, not a
  benefit row, portion present, supported unit or 0-any, points finite ≥ 0 in half steps),
  `resolveCatalog(index, legacyFoods)` → active cards (one per reference food, `canonicalId`), the
  legacy→canonical map, the hidden list and a summary; resolution order explicit → alias → exact →
  hidden; `coffeeReferenceGroup` map for the coffee editor.
- **Verified aliases** `src/data/points-reference/aliases.v1.json` — 76 hand-checked aliases
  (identity-level only; every alias the safety check flags carries a written reason). Loaded into the
  reference index (`BUNDLED_ALIASES`) and seeded into `food_reference_aliases` by the new migration.
- **Search** (`food-search.ts`): foods are indexed under their own name and their aliases
  (`searchNames`); an alias hit returns the ONE canonical card with `matchedAlias` ("נמצא לפי: …").
- **Scoring** (`points.ts`): `scoreDetails` resolves only through a reference row (chosen row, the
  single selectable row of the food's group, or the coffee map); otherwise **unscored** (`pointsValue
null`, basis `unscored:no_reference` / `unscored:ambiguous` / `reference:blocked`, version `ref-v1`).
  No v2-il fallback. `pointsForEntry` returns the snapshot or `null` (never an estimate);
  `unscoredEntries(day)` feeds the "N פריטים ללא ניקוד" note on the today card.
- **Store**: `foods` = canonical active list; `catalog` (full resolution) and `resolveFoodId`; favourites
  / recents mapped through the resolver and de-duplicated; `addEntry` maps a legacy id to the canonical
  food; `addPersonalAlias(name, referenceGroupKey)` replaces `addFood`;
  `personalAliasesSupported` (cloud schema probe: refuses to create aliases until the column exists).
- **UI**: `PersonalAliasForm` (replaces `NewFoodForm`), search result alias line, quantity screen
  without the custom-value path, `EntryRow` shows "ללא ניקוד" and "מאכל ישן, לא במאגר" (no stepper /
  no edit for an unlinked historical entry), `CoffeeSelector` shows the reference points or
  "יישמר ללא ניקוד".
- **Data layer**: `foods.reference_group_key` in types / mappers / repositories; schema probe
  `foodsSchemaSupportsReferenceLink`; DEC-035 custom-value columns no longer written.
- **Migration** `supabase/migrations/20260922090000_reference_only_foods.sql` (+ generated alias seed),
  generated owner wrapper `supabase/apply_reference_only_foods_production.sql` (BEFORE/AFTER counts,
  ledger row), read-only `supabase/verify_reference_only_foods.sql`.
- **Reports**: `docs/POINTS_REFERENCE_RECONCILIATION.md` now before/after (generated).

## C. Before / after (generated, `npm run points:reconcile`)

| metric                                            | before (DEC-035) | after (DEC-036) |
| ------------------------------------------------- | ---------------: | --------------: |
| cards in the active list                          |            1,431 |       **1,121** |
| … reference foods                                 |            1,120 |           1,120 |
| … legacy catalog cards of their own               |              311 |           **0** |
| legacy foods linked by exact name                 |               78 |              78 |
| legacy foods linked by verified alias             |                0 |          **76** |
| legacy foods hidden (history only)                |                0 |         **235** |
| duplicate cards collapsed onto one reference food |                0 |              18 |
| reference rows never offered (conflict / review)  |          84 rows |         84 rows |

Notable hidden legacy foods with **no reference row at all** (need a row from Elena): `מים`,
`מים מוגזים`, `קולה זירו`, `מלח`, and the fat-% families (`קוטג׳`, `גבינה צהובה`, `יוגורט טבעי`…) that
exist in the reference only as specific % rows — those are searchable directly by their reference names.

## D. Tests (evidence)

| gate                                                   | result                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                                                                                                                                                                                                                                                                             |
| `npx eslint .`                                         | 0 errors (9 pre-existing fast-refresh warnings)                                                                                                                                                                                                                                                      |
| `npx vitest run`                                       | **447 passed / 16 skipped** — `store-reference.test.tsx` = the 15 mandatory items + alias validation + coffee map; PGlite migration suite 10 (both wrappers in order, counts identical, aliases seeded, member read-only, personal alias stored); 33 legacy-name tests ported to the reference world |
| `npx playwright test -c playwright.hermetic.config.ts` | **9 passed** on Pixel 7 (alias hit = one card, personal alias flow, blocked unit, no horizontal overflow)                                                                                                                                                                                            |
| `bun run build`                                        | OK; client `index.js` gzip 270 → 272 KB                                                                                                                                                                                                                                                              |
| `npm run points:import / seed / reconcile`             | idempotent ("up to date" on re-run); reports regenerated                                                                                                                                                                                                                                             |

Mapping of the 15 mandatory items → `src/lib/points-reference/store-reference.test.tsx` (numbered).

## E. Data safety

No `food_entries` row deleted or rewritten; historical snapshots keep name / quantity / value even
when their food is hidden (test 13; the PGlite suite re-checks that a reference edit never touches a
snapshot). `foods` rows are never deleted (hidden state is derived at runtime). The migration is
additive (one nullable column + index + alias upsert), idempotent, with a rollback block; the wrapper
prints households / profiles / foods / food_entries BEFORE and AFTER for the owner to compare. RLS and
grants unchanged (verified on PGlite: member can read aliases, cannot write them; anon nothing).

## F. Deployment gate

Merged to `main` because every quality gate passed and the client is defensive: everything except
creating a personal alias works against the current production schema (the schema probe turns the
alias form into a clear message until the column exists). Owner path:

1. `supabase/verify_reference_only_foods.sql` (read-only) → keep BEFORE.
2. `supabase/apply_reference_only_foods_production.sql` (one transaction; prints counts before/after).
3. verify again: §1 identical, §2 column + index, §3 76 aliases, §4 תפוח → תפוח עץ, §8 ledger.
4. Publish `main` from Lovable → `npm run preflight -- --live`.

Publishing is a manual Lovable action in the owner's account; this session cannot trigger it.
