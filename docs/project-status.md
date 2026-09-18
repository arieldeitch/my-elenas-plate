# Project Status

**Date:** 2026-09-18 (third run)
**Branch:** `main` — M2 daily couple experience (home hierarchy, one-tap logging, ownership, quiet
sync) — see `docs/claude-tasks/RUN_2026-09-18_M2_DAILY.md`
**Supabase project:** `rqgoiuztphkcvbwtbxbj` (production) · isolated branch `uyroeumwmjhrcbkesmgb`
**Stage:** **M1 code complete; M1 release blocked on owner actions (`M1_RELEASE_ACCEPTANCE.md`); M2 step 2 done (DEC-026)**
**Deployment:** none performed. The published site is a **pre-M1, demo-mode build** (no Supabase env).
**Pilot-ready code checkpoint:** tag `pilot-ready-2026-07-24` → `29ac1d5`.

> Rule: nothing is listed as "working" unless it was actually run/verified.

## 2026-09-18 (third run) — M2 daily couple experience

Full record: `docs/claude-tasks/RUN_2026-09-18_M2_DAILY.md`, decisions DEC-026. Home is now ME (`TodayCard`)
→ PARTNER (`PartnerGlance` with latest food, slot dots, fasting/workout when present) → ACTION (six
compact tiles on one screen). One-screen meal editor with one-tap quick add from favourites/recents
(2 taps + close instead of 5–6). Ownership: personal colours, "<slot> · <person>" editor header,
`data-owner`. Sync indicator quiet when confirmed. `FoodEntry.loggedAt` read from `created_at`.
`M1_RELEASE_ACCEPTANCE.md` is the single release entrypoint. Gate: typecheck 0 · lint 0/8 · vitest
278 · hermetic Playwright 5/5 · build. Owner actions unchanged.

## 2026-09-18 (second run) — fail-safe runtime, release preflight, `.env.production`, M2 partner glance

Full record: `docs/claude-tasks/RUN_2026-09-18_M2_PREP.md`. A production build without Supabase config is
now **blocked** by `RuntimeGate` (DEC-025); `/build-info.json` + `npm run preflight -- --env|--local|--live`
are the executable release gate; `.env.production` is committed with the public URL/target and one
line for the owner's anon key (Lovable delivers frontend env only via a `.env` file in the code);
the home screen shows the partner's day at a glance (M2 step 1). Gate: typecheck 0 · lint 0/8 ·
vitest 270 · hermetic Playwright 4/4 · build. Owner actions unchanged (key line + Publish; grants SQL).

## 2026-09-18 — M1 promotion run: merged to `main`, release blocked, live site found in demo mode

Full record: `docs/claude-tasks/RUN_2026-09-18_M1_PROMOTION.md`. Summary:

| Item                                          | Result                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality gate on `edc2d54` (second machine)    | typecheck 0 errors · eslint 0 errors / 8 warnings (after a 3-file prettier fix) · vitest **254 passed**, 15 skipped (gated live suites) · `vite build` OK, SHA `edc2d54` embedded · hermetic Playwright **3/3**. Live/branch suites not re-run here (no branch credentials on this machine). |
| Grants migration `20260916120000`             | **Reviewed GREEN, not applied** — no access path to production from this session. Apply via `supabase/DEPLOY.md` §"M1 release".                                                                                                                                                              |
| Published build `my-elenas-plate.lovable.app` | **Demo mode** — bundle has empty `VITE_SUPABASE_*`, `isSupabaseConfigured()` ⇒ `false`; no Supabase host in HTML/JS. Client code ≈ `main` ≥ `6768c99`, no build SHA. `x-deployment-id 0c0eb717…`. Nothing users log there reaches Supabase.                                                  |
| Live M1 acceptance                            | 3 × FAIL by construction (shared visibility, cross-device propagation, local-state-as-truth), 7 × NOT TESTABLE (no authenticated browser). No production data touched.                                                                                                                       |
| Docker                                        | Not installed on this machine. Repo audit: no script starts Docker; stale `npx supabase start` hint removed from `claude-context.md`; `.claude/settings.json` deny rules added; workstation checklist in `NO_LOCAL_DOCKER_POLICY.md`.                                                        |
| Git                                           | `recovery/m1-shared-truth` merged into `main` with `--no-ff`; both pushed.                                                                                                                                                                                                                   |

## 2026-08-01 — Deployment assessment: none required, none performed

`main` is at `d5d2ce3` and synchronized with `origin/main`. **No deployment was required and none was
performed.**

### Why no deployment is required

Everything merged since the last known production state (`8667b3c`) is documentation plus one test file:

| File                                                                                                            | Ships to production?           |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `docs/claude-context.md`, `docs/decisions.md`, `docs/gpt-handover.md`, `docs/project-status.md`, `docs/todo.md` | No                             |
| `src/lib/supabase/remote-live.integration.test.ts`                                                              | No — `.test.ts`, never bundled |

`git diff --name-only 8667b3c..d5d2ce3` filtered for non-docs, non-test files returns **nothing**. Zero
runtime code changed, so a production bundle built from `d5d2ce3` is functionally identical to one built
from `8667b3c`. Deploying would be a no-op.

### Deployment mechanism, as verified (not assumed)

| Check                                                                          | Result                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `.github/workflows/`                                                           | **Absent** — no GitHub Actions                                                  |
| `gh run list`                                                                  | **Zero runs** — no CI has ever executed                                         |
| GitHub Deployments API                                                         | **Empty** — no platform integration has ever registered a deployment            |
| GitHub Pages                                                                   | 404 — not used                                                                  |
| `deploy`/`publish` script in `package.json`                                    | **None**                                                                        |
| Committed `wrangler.toml` / `nitro.config.ts` / `vercel.json` / `netlify.toml` | **None** — `.output/server/wrangler.json` is generated per build and gitignored |
| `npx wrangler whoami`                                                          | **Not authenticated**                                                           |
| Production URL documented anywhere in the repo                                 | **None found**                                                                  |

**Conclusion: pushing to `main` triggers nothing.** The project is a Lovable project
(`.lovable/project.json`, template `tanstack_start_ts_current`); per the README, GitHub and Lovable sync
_code_, and publishing is a manual action in the Lovable editor. That is the real deployment path, it is
outside this environment, and it requires the owner's Lovable session.

### Not verified, and why

The live production state could not be inspected: no production URL is recorded in the repository, docs
or environment, and no deployment integration exposes one. So this section asserts only what was checked
— that no runtime code changed and that no automated deployment exists. It does **not** claim to have
observed the running site.

### Quality gate (2026-08-01, on `main` @ `d5d2ce3`)

| Check                                    | Result                                                                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                           | **PASS** — exit 0                                                                                                                                                                                                                             |
| `eslint .`                               | **PASS** — 0 errors, 8 pre-existing dev-only HMR warnings                                                                                                                                                                                     |
| `vitest run`                             | **PASS** — 186 passed, 12 gated skipped                                                                                                                                                                                                       |
| `vite build`                             | **PASS**                                                                                                                                                                                                                                      |
| `prettier --check` on all authored files | **PASS**                                                                                                                                                                                                                                      |
| `prettier --check .` repo-wide           | 5 pre-existing offenders, none authored here: `AGENTS.md` and `src/routes/README.md` (both last touched by Lovable, 2026-07-22), two untracked local user files, and `supabase/.temp/` (gitignored CLI artifact). Left untouched deliberately |

## 2026-08-01 — T-034 split into backend (Done) and UI (Blocked) — DEC-023

**T-034 is closed as "Backend Verified".** Every acceptance criterion not requiring a rendered browser
is proven; the evidence is in the section below. The browser-dependent remainder is tracked separately
as **T-034-UI**, which is **Blocked** until a browser automation capability exists.

A **Silent Production Self-Test** was designed and then **deliberately not built** (DEC-023). It would
have added diagnostics tables, a feature flag, a two-stage background engine and a migration, and would
have written to production automatically on a household member's device — to save about two minutes of
ordinary app use. It also would not have closed the real gap, because profile rendering, profile
switching and on-screen search results cannot be observed from a headless in-app test. **No diagnostics
table, feature flag, background self-test, temporary migration, diagnostic entity, production write or
deployment-only verification code was added. The production schema is unchanged.**

What was proven, and what was not, is listed precisely below. Nothing here claims that anyone signed in
to production.

### Verified against the live production project `rqgoiuztphkcvbwtbxbj`

Read-only anonymous probe over REST. **No row was created, updated or deleted.** 11/11 passed:

| probe                                                                                                                                                 | result                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| anonymous read of `profiles`, `households`, `foods`, `food_entries`, `meal_statuses`, `food_preferences`, `weigh_ins`, `fasting_logs`, `workout_logs` | **PASS** — 9/9 return zero rows (RLS hides them) |
| `rpc/bootstrap_household` unauthenticated                                                                                                             | **PASS** — rejected, HTTP 400                    |
| anonymous `INSERT` into `weigh_ins`                                                                                                                   | **PASS** — rejected, HTTP 401                    |

This confirms RLS is enforced in production and that there is no anonymous read or write access.

### Verified against a local stack running the identical migrations

Both gated live suites — **12/12 passed** (previously skipped for lack of env):

- bootstrap creates exactly two profiles (אריאל, אלנה) and is **idempotent**
- the shared account can write **and** read **both** profiles' data
- household isolation: an unrelated account sees none of the household's rows
- coffee milk-type CHECK constraint rejected at the DB
- anonymous reads denied
- CRUD across every table for a profile
- coffee round-trip through the DB
- upsert idempotency — no optimistic duplication
- local→cloud migration transform uploads a legacy state
- custom foods + favorites + recents sync **per profile with isolation**
- realtime: a second context sees INSERT, UPDATE and DELETE

Test accounts and households created by these suites exist **only in the ephemeral local Docker stack**.
No household or account was created in production.

### Bug found and fixed — flaky realtime test (test-only, see DEC-022)

`realtime: a second context sees insert, update and delete` failed consistently against the local
stack. Isolated diagnosis (broadcast vs `postgres_changes`) proved the WebSocket, the publication and
the app code were all correct, and that `REPLICA IDENTITY FULL` was **not** the cause (tried and
reverted). Root cause: realtime evaluates the RLS check for a `postgres_changes` event against the
**current** row, so firing `insert → update → delete` back-to-back lets the delete land before the
UPDATE WAL record is processed — the row is gone, the check finds nothing, and the UPDATE event is
silently dropped. The test now awaits each event before the next mutation. Runtime dropped from 85 s
(timeout) to **3.7 s**. **No product code, schema, RLS or migration was changed.**

Two local-environment faults were also cleared during diagnosis, both infrastructure-only: a Kong
container needing a restart before WebSocket upgrades succeeded, and auth 504s under load (three
Supabase stacks were running on the machine at once).

### Still unproven — now tracked as T-034-UI (Blocked)

Everything requiring a rendered, authenticated browser: production sign-in, both profiles rendering in
the live UI, profile switching preserving the active date, catalog search returning items on screen,
adding a real entry to production through the UI, and refresh persistence against production. The
assistant has no credentials, and creating a throwaway account would add a second household to the clean
pilot project.

This is **not** a defect and **not** a pending fix — it is a verification that requires a capability the
project does not currently have. It runs when browser automation becomes available (Chrome DevTools MCP,
Playwright against an authenticated session, or equivalent). Until then T-034-UI stays open, and T-034
must be described as **Backend Verified**, never as fully verified.

### Quality gate (2026-08-01)

| Check                            | Result                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| `tsc --noEmit`                   | PASS — 0 errors                                            |
| `eslint .`                       | PASS — 0 errors, 8 pre-existing dev-only HMR warnings      |
| `vitest run`                     | PASS — 186 passed, 12 gated live tests skipped without env |
| Gated live suites vs local stack | PASS — **12/12**                                           |
| `vite build`                     | PASS                                                       |
| `prettier --check`               | PASS                                                       |

## Current verified state (2026-07-25)

- Repository is active, `main` is synchronized with `origin/main`, and the deployed code matches.
- Supabase project `rqgoiuztphkcvbwtbxbj` is the live environment, and the application configuration
  points at it (verified in the client module the running app actually loads, not only in `.env`).
- **The production bootstrap completed successfully.** It was applied once, manually, in the Supabase
  SQL Editor, and its final report returned `READY`. It is historical and applied — see DEC-021: it
  must not be rerun.
- One shared household exists.
- Two profiles exist: **אריאל (Ariel)** and **אלנה (Elena)**.
- Two household memberships exist.
- Six meal slots are defined.
- Ten relevant tables have RLS enabled.
- **390 active foods** exist in the catalog.
- Transactional nutrition data was empty at the production baseline (`weigh_ins = 0`; no meal,
  fasting or workout records).
- All demo/mock-data paths were removed from the application.
- **The application is ready for the first real logging.** No further SQL action is required.

### Verified baseline counts

| check                           | value     |
| ------------------------------- | --------- |
| households                      | 1         |
| household_memberships           | 2         |
| profiles (אריאל / אלנה)         | 2         |
| meal_slots_defined              | 6         |
| tables_with_rls                 | 10        |
| active foods                    | **390**   |
| weigh_ins                       | 0         |
| duplicate normalized food names | 0         |
| **status**                      | **READY** |

### Quality status (verified 2026-07-25)

| Check                                 | Result                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| TypeScript typecheck (`tsc --noEmit`) | PASS — 0 errors                                                           |
| Lint (`eslint .`)                     | PASS — 0 errors, 8 pre-existing dev-only HMR warnings                     |
| Automated tests (`vitest run`)        | PASS — 186 passed, 2 gated live suites skipped (12 tests, no env)         |
| Production build (`vite build`)       | PASS                                                                      |
| Formatting (`prettier --check`)       | PASS                                                                      |
| Deterministic catalog SQL generator   | PASS — regenerating is byte-identical; a staled block is restored exactly |
| Secret scan                           | PASS — no secrets, no `.env`, no service_role committed                   |

The 186 figure supersedes the 173 reported at commit `6768c99`: the bootstrap-script tests
(13 additional assertions on `supabase/bootstrap_and_seed.sql`) were added afterwards.

## 2026-07-25 — DATABASE APPLIED. Catalog live in Supabase.

### Applied result (verified by the user in the SQL Editor, project `rqgoiuztphkcvbwtbxbj`)

`supabase/bootstrap_and_seed.sql` was run once. Final report:

| check                   | value     |
| ----------------------- | --------- |
| households              | 1         |
| household_memberships   | 2         |
| profiles_ariel_alena    | 2         |
| meal_slots_defined      | 6         |
| tables_with_rls         | 10        |
| foods_active (`result`) | **390**   |
| weigh_ins               | 0         |
| **status**              | **READY** |

### Why the first attempt reported zeros (root cause, resolved)

The catalog seed inserts one row per household
(`from public.households h cross join catalog c`). Project `rqgoiuztphkcvbwtbxbj` had the full schema
and RLS but **zero households**, because `bootstrap_household()` only runs when an account signs in
and that had never happened there. So the seed correctly inserted 0 rows. The cleanup migration was
never at fault, and running it twice was harmless: its only `DELETE` against `foods` targets the exact
literal `מאכל בדיקה`, so it can never remove a previously seeded catalog (now test-asserted).
`supabase/bootstrap_and_seed.sql` created the household, its membership and the two profiles — the
same thing `bootstrap_household()` does — and then seeded.

### Post-deployment verification (2026-07-25)

Verified here:

- **Connectivity** — the running app's client module resolves to project `rqgoiuztphkcvbwtbxbj`
  (checked in the served bundle, not just in `.env`); `vite dev` serves HTTP 200.
- **RLS still enforced** — anonymous REST reads of `profiles`, `foods` and `food_entries` all return
  `[]` (rows hidden, not missing — the SQL report proves 390 exist), and
  `rpc/bootstrap_household` unauthenticated returns HTTP 400 ("not authenticated").
- **Catalog + search** — 107 targeted tests green, including all 13 checklist searches
  (מלפפון · עגבניה→עגבנייה · גבינה צהובה · שניצל · אורז · חזה עוף · סלט · מים · קפה · קוטג→קוטג׳ ·
  פיתה · טחינה, plus `קוטג'`, `צ'יפס`, vocalised `לֶחֶם מָלֵא`), exact-match-ranks-first, the 20-result
  cap, and the per-food unit sets.
- **No mock data can be produced** — no seed path exists in the app; the store starts empty in every
  mode; the localStorage→cloud import is disabled; the seed writes no favorite, recent or entry row
  (all test-asserted). `weigh_ins = 0` in the applied report.
- **No temporary verification rows were created**, so there was nothing to clean up and the database
  is pristine for the first real day.

Not verified here, and why: signing in to the app needs the household account's credentials, which are
not available to the assistant, and creating a throwaway account would create a second household. So
the in-browser checks — profile switching, the catalog rendering from Supabase, and adding then
deleting one entry per profile — are covered by automated tests but were not observed in the live UI.
The first real log on 2026-07-26 is that confirmation.

### Catalog

- **390 active items across 14 categories**, authored in category modules under `src/data/foods/`
  (`vegetables`, `fruits`, `dairy-and-eggs`, `breads-and-grains`, `legumes`, `meat-and-fish`,
  `dishes`, `snacks-and-sweets`, `drinks`, `condiments`, plus `types` + `index`). Coverage spans
  foods, drinks, ingredients, spreads, snacks, dishes, vegetables, fruits, dairy, eggs, grains,
  breads, legumes, meat, poultry, fish, sauces and common Israeli meals.
- Per-category counts (14): ירקות ועשבי תיבול 45 · פירות 36 · מוצרי חלב ותחליפים 28 · ביצים 7 ·
  לחם ומאפים 27 · דגנים ופחמימות 24 · קטניות 15 · עוף ובשר 33 · דגים 20 · מנות ותבשילים 55 ·
  אגוזים, גרעינים וממרחים 22 · חטיפים ומתוקים 29 · משקאות 31 · רטבים, שמנים ותבלינים 18.
- Fields only: `name`, `normalized_name`, `category`, `default_unit`, `kind`, `is_active`
  (+ client-side `suggestedUnits`). **No** calories, macros, health labels, scores, favorites,
  recents or entries. `allowed_units` does not exist in this schema — unit sets stay client-side.
- 41 practical unit presets from the existing `Unit` union; the default unit is always the first
  offered unit. Verified examples: מלפפון = יחידה/חצי יחידה/גרם · גבינה צהובה = פרוסה/גרם ·
  שניצל עוף = יחידה/מנה/גרם · מים = מ״ל/כוס/ליטר · אורז לבן = כוס/כף/מנה/גרם · קפה default כוס.
- Supabase is the source of truth (DEC-019): `mergeCatalog` lets a remote row supersede the bundled
  item by `normalized_name`, an `is_active = false` row hides it, and the bundled list is the
  offline / pre-seed fallback. The app food id stays `f_*` so favorites/recents survive the seed.

### Normalization + search (DEC-020)

- `src/lib/food-normalize.ts` — one key for search, duplicate prevention and `normalized_name`:
  hyphen/slash → space, geresh & all apostrophe variants removed, niqqud removed, punctuation
  removed, Latin lowercased, ktiv male folded (`יי`→`י`, `וו`→`ו`), whitespace collapsed, trimmed.
  Idempotent. No alias subsystem, no new dependency.
- Verified searches (automated): `מלפפון`, `עגבניה`→עגבנייה, `עגבנייה`, `גבינה צהובה`, `שניצל`
  (3+ hits), `אורז`, `חזה עוף`, `סלט`, `מים`, `קפה` (+שחור/נמס/הפוך), `קוטג`→קוטג׳, `פיתה`,
  `טחינה`, `קוטג'`, `צ'יפס`, and vocalised `לֶחֶם מָלֵא`.
- `src/lib/food-search.ts` — index built once per list change (not per keystroke); ranking
  exact → prefix → word-prefix → substring; **capped at 20 results**, empty query returns none, so
  the full catalog is never rendered.
- Duplicate prevention: `addFood` returns the existing food when the normalized name matches
  (`קוטג'` → the catalog's `קוטג׳`), which also protects the DB's
  `unique (household_id, normalized_name)`.

### Mock-data paths removed from production code

| Path                                                                                | Action                                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/demo-data.ts` (fake days, weigh-ins, favorites, recents, fasting, workout) | **Deleted**                                                                                                      |
| `store.tsx` seeding of days/weighIns/favorites/recents                              | **Removed** — starts empty in every mode                                                                         |
| `store.tsx` localStorage hydration in configured mode                               | **Guarded** — demo mode only                                                                                     |
| localStorage→cloud one-time import                                                  | **Disabled** (`LOCAL_IMPORT_ENABLED = false`) so a stale demo snapshot cannot repopulate the cloud after cleanup |
| Old 23-item client catalog + weak `normalize`                                       | **Replaced** by `src/data/foods/*` + `food-normalize.ts`                                                         |

Legitimate test fixtures were kept. Tests that had asserted against the demo seed
(`WeightBanner`, `FastingCard`, `WorkoutCard`) now create their own data through the store API.

### Cleanup + seed migration (APPLIED 2026-07-25 — do not rerun, DEC-021)

`supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql`
Applied manually through the Supabase SQL Editor together with
`supabase/bootstrap_and_seed.sql`, which supplies the household the seed needs. Read-only re-checks
use `supabase/verify_catalog.sql`; troubleshooting must never rerun the bootstrap.

How mock rows are identified — **no rule uses a date, and none is based on row age**:

1. **Test households** — every member's `auth.users.email` matches the generated shape
   `^(e2e|t|live)_[0-9]{13}_[0-9]+@` produced by `e2e/helpers.ts`,
   `rls.integration.test.ts` and `remote-live.integration.test.ts`. Deleting the household row
   cascades to its own data. A household with one real member is never touched; `auth.users` is
   only read, never modified.
2. **Demo days** — the complete multiset of a day's entries (slot · food name · quantity mode ·
   amount · unit · subjective) must equal one of the four exact day shapes built by the removed
   `demo-data.ts` (`meDay`, `elenaDay`, `fullSampleDay`, `partialSampleDay`). One extra or missing
   entry preserves the whole day. Value-only matching is deliberately not used, because
   e.g. "קפה · 1 · כוס" is also what a real fast-add produces.
3. **Demo favorites/recents** — `last_used_at` exactly on `to_timestamp(1784000000 - n*60)`, the
   fixed `RECENCY_BASE_MS` epoch from `sync/migrate-local.ts` (real usage stamps `Date.now()`);
   and, independently, a profile whose complete preference id set equals the demo union for its slug.
4. **Demo weigh-ins** — exact `(weight_kg, body_fat_pct)` pairs from `demo-data.ts` **and** the
   profile has no other weigh-in. Any real weigh-in makes that profile untouchable.
5. **E2E fixture food** — the exact literal name `מאכל בדיקה` from `crud.spec.ts`.

Fasting (`20:30`→`12:30`) and workout (`הליכה`/`טוב`) rows are deleted **only** inside a day already
proven to be a demo day by rule 2 — those values alone are plausible real input.

Preserved by construction: `auth.users`, households/memberships/profiles of real accounts, the six
meal slots (a CHECK constraint, not data — no DDL touches it), RLS and every policy, settings, all
existing migrations, and every row not matched by a fingerprint. No `TRUNCATE`, no unconditional
`DELETE`, no `USING (true)`, no service-role usage. One additive index
(`foods_household_normalized_idx`); no column/constraint/policy change.

Idempotency: cleanup is fingerprint-driven so a second run matches nothing; the seed is
`on conflict (household_id, normalized_name) do update`, which never grows the catalog and
deliberately does **not** reset `is_active` (so an archived food is not resurrected).

Auditability: the migration writes before/after counts into a temporary report table and ends with a
`SELECT` returning them — counts only, no names, weights or dates. `supabase/verify_catalog.sql` is a
read-only re-check (household/profile/meal-slot/RLS/catalog/duplicate/tracking-table counts) safe to
run any number of times.

SQL↔TypeScript parity: the seed block is generated by `npm run catalog:seed`
(`scripts/generate-catalog-seed.ts` + `catalog-seed-sql.ts`, run through the already-present
`vite-node` — no new dependency) and `src/lib/catalog-seed.test.ts` fails if the committed file is not
the current generated form. Verified: regenerating twice is byte-identical, and a deliberately staled
block is restored exactly.

### Tests added (2026-07-25)

| Suite                            | Tests | Covers                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food-normalize.test.ts`         | 11    | geresh/apostrophe variants, niqqud, ktiv male, separators, punctuation, Latin case, idempotency, false-merge guards (`פטה`≠`פיתה`)                                                                                                                                                                                                    |
| `food-catalog.test.ts`           | 25    | ≥300 items, no blank/duplicate normalized names, unique `f_*` ids, valid units, default ∈ allowed, ≥15 distinct unit sets, all categories used & populated, no nutrition/favorite fields, no placeholder or numbered names, one coffee-kind food, 13 checklist searches, ranking, result cap, `mergeCatalog` supersede/archive/dedupe |
| `catalog-seed.test.ts`           | 16    | SQL is the current generated form, one row per item, idempotent upsert, seeds every household, writes no preferences/entries, schema-only columns, no RLS/policy/TRUNCATE/auth changes, no unqualified DELETE, delete-target allowlist, fingerprint & epoch presence, before/after reporting                                          |
| `store.test.tsx` (extended)      | +6    | empty start for both profiles, catalog exposed with no preferences, normalized-duplicate reuse, genuine custom food still created, favorite only on request, recent only after logging, per-profile separation                                                                                                                        |
| `MealEditor.test.tsx` (extended) | +5    | favorites/recents empty until use, capped results, subjective mode, food-specific units (פרוסה not חצי יחידה), apostrophe duplicate resolves to the catalog item                                                                                                                                                                      |

### Not verified / cannot be claimed

- Nothing about the live database: no cleanup, no seeding, no row counts, no post-refresh check.
- `npm run e2e` was not re-run (it drives the remote project that T-033 is about to change, and would
  create new `e2e_*` households in the pilot project).
- Whether the demo seed ever actually reached the remote household is unknown from here; the
  migration handles both cases and reports what it found.

### Ambiguous data intentionally preserved

- Any weigh-in matching a demo value pair for a profile that also has other weigh-ins (counted as
  `weigh_ins_preserved_ambiguous` in the migration report, never deleted).
- Any day whose entry multiset does not exactly match a demo shape — including manual rows created
  while testing the app in the browser, which are indistinguishable from real logging by value.
- Any custom food other than the exact `מאכל בדיקה` fixture.
- Any household with at least one non-test member address.

## Repository state & GitHub sync (2026-07-24)

- Branch `main`. Verified code checkpoint = tag `pilot-ready-2026-07-24` at `29ac1d5`.
- **Divergence resolved:** Lovable pushed 12 branding commits to `origin/main` after the checkpoint; this
  session integrated them via a normal **merge** (no file overlap with docs, no rewrite, no force-push).
  Merged tree is green (tsc, 109 hermetic tests, build). The Playwright suite was not re-run after the
  branding merge (docs-only session) — re-run `npm run e2e` next session.
- Remote: `https://github.com/arieldeitch/my-elenas-plate.git`.
- Working tree clean (only the untracked reference folder `nutrition-tracker-knowledge-pack-complete/`).
- No secrets/artifacts tracked — only `.env.example`. `.env`, `.env.e2e`, Playwright artifacts,
  `package-lock.json`, `coverage/` are gitignored.
- Safe to open and edit from Lovable (pulls `main`). Rollback to the verified backend/E2E checkpoint:
  `git checkout pilot-ready-2026-07-24`.

## Branding

- **Done in Lovable:** wordmark "בריאותי"; the calm healthcare pastel design system (green primary,
  per-slot soft tints, soft shadows, rounded cards); coherent typography scale (≥12px content floor);
  per-meal-slot lucide iconography + status badges/pills; RTL mobile-first layout.
- **Brand illustration added by Lovable (2026-07-24, merged):** `src/components/brand/BrandIllustration.tsx`
  (a shared PNG asset with `header` / `auth` / `empty-state` / `loading` variants) — now used in the
  header (`BrandMark`), the auth loading state (`AuthGate`) and the sign-in screen; `favicon.png` replaced
  the old `.ico`. This addresses the previously-desired "stronger illustration presence".
- **Still desired (optional refinement):** applying illustration variants to the six meal-slot tiles and
  empty states, and general visual polish — keeping the calm, uncluttered, non-judgmental tone. See
  `gpt-handover.md` §10–11.

## Stack (verified from the repo)

| Area             | Actual                                                                                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | TanStack Start (SSR) + React 19                                                                                                                                                                                                                                                           |
| Router           | @tanstack/react-router (file-based, `src/routes`)                                                                                                                                                                                                                                         |
| Server state     | @tanstack/react-query (provider only; app state is a custom store)                                                                                                                                                                                                                        |
| Build tool       | Vite 8 (`@lovable.dev/vite-tanstack-config`, nitro → Cloudflare target)                                                                                                                                                                                                                   |
| Styling          | Tailwind CSS v4 + shadcn/ui (Radix)                                                                                                                                                                                                                                                       |
| Forms/validation | react-hook-form + zod present; nutrition screens use controlled inputs + pure validators                                                                                                                                                                                                  |
| Icons            | lucide-react                                                                                                                                                                                                                                                                              |
| Package manager  | bun (bun.lock committed); this session used npm to install (bun not present)                                                                                                                                                                                                              |
| Tests            | **Vitest + Testing Library (added this session)**                                                                                                                                                                                                                                         |
| Backend          | **Supabase integration implemented (opt-in via env).** Schema + RLS + realtime + bootstrap migrations under `supabase/`; typed client, repositories, auth UI, gated store sync, offline queue and local→cloud migration. With no env vars the app runs in local demo mode (localStorage). |

## Quality gate (latest verified run: 2026-07-25)

| Check                     | Command                                   | Result                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type check                | `tsc --noEmit`                            | PASS — 0 errors                                                                                                                                                                                                                                                                                                                                              |
| Lint                      | `eslint .`                                | PASS — 0 errors, 8 warnings (see "Remaining warnings" below)                                                                                                                                                                                                                                                                                                 |
| Format                    | `prettier`                                | PASS — changed + previously-unformatted source files normalised; `endOfLine: auto` added for cross-platform CRLF                                                                                                                                                                                                                                             |
| Unit/integration tests    | `vitest run`                              | PASS — 186 passed / 12 skipped (2 live suites, no env)                                                                                                                                                                                                                                                                                                       |
| Live DB (RLS + bootstrap) | `supabase start` + gated integration test | PASS — 5/5 against local Supabase (bootstrap, isolation, anon-denied, coffee CHECK)                                                                                                                                                                                                                                                                          |
| Live remote (RLS+CRUD+RT) | 2 gated suites vs remote project          | PASS — 12/12 (auth, bootstrap, RLS isolation, CRUD all tables, coffee, idempotency, migration, custom foods + favorites/recents + isolation, 2-context realtime)                                                                                                                                                                                             |
| Migration validation      | `psql < each migration`                   | PASS — all 5 apply cleanly (10 tables, 35 policies, 8 realtime tables; food_id->text)                                                                                                                                                                                                                                                                        |
| Generated types           | `supabase gen types --local`              | Matches hand-derived aliases; committed as `database.generated.ts`                                                                                                                                                                                                                                                                                           |
| Accessibility             | `vitest-axe` on 5 key components          | PASS — 0 violations (MealCard, CoffeeSelector, ProfileSwitcher, DailyCompletionIndicator, WeightBanner)                                                                                                                                                                                                                                                      |
| Browser E2E               | `playwright test` (`npm run e2e`)         | PASS on 2026-07-24; deliberately NOT re-run against the pilot project (it signs up `e2e_*` accounts, which would create extra households) — 10 specs vs live Supabase (auth/RTL/mobile, meal+coffee CRUD, custom + built-in foods/favorites/recents, fasting/workout/weigh-in, profile separation, session lifecycle, 2-context realtime, offline+reconnect) |
| Build                     | `vite build`                              | PASS — SSR + client build succeeds                                                                                                                                                                                                                                                                                                                           |
| SSR smoke                 | `vite dev` + curl                         | PASS — Home renders; profiles אריאל/אלנה, six slots, RTL; no "אני", no "ארוחת לילה"; no hydration warnings                                                                                                                                                                                                                                                   |
| Secret scan               | grep                                      | PASS — no secrets, no `.env`, no service_role                                                                                                                                                                                                                                                                                                                |

### Remaining warnings (8, non-blocking, dev-only)

All are `react-refresh/only-export-components` — a Fast-Refresh (HMR) hint with **no runtime or production impact**. Not suppressed globally.

- 6 in vendored shadcn/ui files that export a variance/util next to the component: `ui/badge.tsx`, `ui/button.tsx`, `ui/form.tsx`, `ui/navigation-menu.tsx`, `ui/sidebar.tsx`, `ui/toggle.tsx`.
- 2 in `src/lib/store.tsx` (the `StoreProvider` component colocated with the `useStore` hook and `PROFILES` const). Kept colocated deliberately — splitting would churn 9+ import sites (the public `@/lib/store` API) for a dev-only hint.

### Accessibility / QA improvements this pass

- `prefers-reduced-motion` reset added to `styles.css` (neutralises animations/transitions).
- Icon-only interactive controls raised to 44px (entry-row favorite/edit/delete, fasting/workout edit).
- MealEditor moves focus into the dialog on open (keyboard + screen-reader).
- axe automated a11y checks added for the key components.

## Working (verified)

- App shell, Hebrew RTL (`lang="he" dir="rtl"`), mobile-first layout, bottom nav, weight banner.
- Profiles: **אריאל** and **אלנה**, one-tap switch, date preserved on switch, data separated per profile (unit-tested).
- Date navigation (prev/next/today, calendar).
- Six meal slots with correct current labels; completeness computed only from the six slots; `skipped` counts as complete (unit-tested).
- Meal editor: add / edit / delete / undo, empty & skipped states, auto-save indicator.
- Food search (debounced, normalized), recent & favorite foods, create-new-food.
- Quantity: measured (positive amount + unit) and subjective (מעט/במידה/הרבה/מוגזם); subjective never converted to a number (unit-tested).
- **Coffee logging (new):** structured type + milk + optional milk-type + quantity + note; validation and milk-type clearing unit-tested; appears in search/recents/favorites; edit/delete/undo; profile & date separated; persists.
- Fasting (midnight crossover, unit-tested), workout, weigh-ins + fat mass + weight delta (unit-tested), weight banner.
- Calendar full/partial/empty with shape + color; fasting/workout/weight do not affect completeness.
- **Interim persistence:** localStorage — refresh / date change / profile switch keep data (unit-tested via fresh remount).

## Supabase backend (implemented 2026-07-23)

Approved model: **one shared Auth account** for the household with **two internal profiles**
(אריאל `ariel`, אלנה `alena`). Data is separated by `profile_id`; the shared account edits both.
Supabase is the source of truth when configured; localStorage is demoted to demo/queue/cache only.

- **Migrations** (`supabase/migrations/`): `schema`, `rls`, `bootstrap`, `realtime`.
  - 10 tables (households, household_users, profiles, foods, food_preferences, meal_statuses,
    food_entries, fasting_logs, workout_logs, weigh_ins). UUID PKs, timestamptz, `updated_at` triggers,
    check constraints (slots, statuses, quantity modes, coffee milk-type compatibility, weight/body-fat).
  - RLS on all 10 tables via `is_household_member(uuid)` (SECURITY DEFINER); 35 policies (select/insert/update/delete).
  - `bootstrap_household()` idempotent RPC creates the household + membership + two profiles.
  - Realtime publication for 8 data tables.
- **App layer**: `src/lib/supabase/{client,database.types,database.generated,mappers,repositories,auth}`,
  `src/lib/sync/{queue,migrate-local,supabase-sync,use-supabase-sync}`, `src/components/auth/{SignIn,AuthGate}`.
- **Gated store sync**: hydrate current day + weigh-ins, dirty-tracked reconciling push, realtime re-hydrate.
  Optimistic UI = existing synchronous local update; offline queue for durability. Inert in demo mode.
- **Local verification (Supabase CLI + Docker):** `supabase start` applied all migrations; live integration
  test (5/5) proved bootstrap (2 profiles, idempotent), shared-account read/write of both profiles, the
  coffee milk-type CHECK, **household isolation (RLS)** and **anonymous reads denied**.

### Env required to activate

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Anon key only — never service_role.

### Remote deployment status (2026-07-23)

- **`.env` provided** (project ref `rqgoiuztphkcvbwtbxbj`), anon key verified (`role: anon`, not
  service_role), gitignored. No env/secret is committed.
- **Migrations applied to the remote** (user ran `supabase db push`; "Finished supabase db push").
- **Remote verification (REST layer, without a session):**
  - All **10 tables exist** (`households, household_users, profiles, foods, food_preferences,
meal_statuses, food_entries, fasting_logs, workout_logs, weigh_ins`).
  - **RLS active**: anonymous SELECT returns `[]` on every data table; anonymous INSERT is rejected with
    `42501 new row violates row-level security policy` (HTTP 401).
  - **`bootstrap_household()` RPC exists** (present, not 404).
  - Structure (constraints, indexes, `updated_at` triggers, 35 policies, 8 realtime tables) is confirmed
    **by equivalence**: the pushed migrations are byte-identical to the ones verified against a local
    Supabase stack (5/5 RLS integration there). Deeper remote introspection needs DB access (not anon).
- **App wiring verified**: with `.env` the app enters configured mode — demo UI hidden, AuthGate → SignIn
  renders. Remote Auth (GoTrue) + REST are live.

### Live remote verification (2026-07-23, "Confirm email" disabled)

Two gated live suites ran against the **remote** project (`rqgoiuztphkcvbwtbxbj`) — **10/10 passing**,
realtime stable across 3 consecutive runs:

- **Auth**: sign-up returns a real session (autoconfirm); `nutritiontracker.dev` accepted (example.com is
  rejected by the project).
- **Bootstrap**: creates exactly one household + two profiles (אריאל `ariel`, אלנה `alena`); repeated call
  returns the same household (idempotent, no duplicates).
- **RLS**: anonymous denied (read `[]`, write `42501`); an unrelated authenticated account sees none of
  another household's rows; the shared account reads/writes **both** profiles; no cross-household access.
- **CRUD (all tables)**: `meal_statuses`, `food_entries`, `fasting_logs`, `workout_logs`, `weigh_ins`,
  `foods`, `food_preferences` — insert / update / delete / read verified.
- **Coffee**: round-trips through the DB (`entryToRow`→row→`entryFromRow`); the DB CHECK rejects a raw
  milk-type-without-milk row; `entryToRow` also sanitises it (defence in depth).
- **Idempotency / no optimistic duplication**: upserting the same UUID twice yields one row.
- **Local→cloud migration**: `buildMigrationPayload` + upload lands the expected rows.
- **Two-context Realtime**: a second client authenticated as the same shared account receives INSERT,
  UPDATE and DELETE events (auth token set on the realtime socket).

Run locally with `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_EMAIL_DOMAIN` set (these
files skip in the hermetic `npm test`).

### Foods / favorites / recents sync (T-027, done 2026-07-23)

`useSupabaseSync` now also syncs **custom foods** (`foods`), **favorites** and **recents**
(`food_preferences`), keyed per profile, with optimistic UI + dirty-tracked push + realtime re-hydrate

- offline queue + one-time migration (separate `foods:v1` marker). Migration
  `20260723090400_food_prefs_text_id.sql` makes `food_preferences.food_id` a text app-id so BOTH built-in
  and custom foods can be favorited/recented. Verified live (7/7 remote-live incl. custom foods create +
  per-profile favorites/recents + isolation + soft-delete/archive + realtime).

* **Remote deployment: COMPLETE (2026-07-24).** Migration `20260723090400_food_prefs_text_id.sql` is
  applied to the **remote** (verified behaviourally: an anon insert of a text `food_id` like `f_coffee`
  returns `42501` RLS — not `22P02` uuid — so the column is text). **Built-in AND custom** food
  favorites/recents now sync on the remote; verified live in the browser (E2E, per-profile separation).

### Browser E2E (T-028, done 2026-07-24)

Playwright drives the real app (dev server) against a live Supabase (local stack for reliable runs;
`--mode e2e` → `.env.e2e`, else `.env`/remote). **10 specs pass** (`npm run e2e`):

- Sign-in + bootstrap + RTL + six meal slots + mobile viewport (no horizontal overflow).
- Meal + coffee CRUD with refresh persistence; custom AND built-in food favorites/recents (per-profile
  separation); fasting + workout + weigh-in persist; profile switching keeps data separate; session
  lifecycle (clear session → re-login →
  cloud data returns); two-context realtime; offline mutation → reconnect flush → no duplicate.

**Real bugs found and fixed via E2E (production-readiness):**

1. `MealEditor` reset its view on every parent re-render (unstable `onClose` in its effect deps) — with
   sync active it reset the open editor mid-flow. Split the effect (reset on slot change only) + stabilised
   home handlers.
2. In configured mode the store seeded demo data (non-UUID ids like `e_1`) into a **fresh cloud account**
   and even persisted it to localStorage → migration/push failures. Now the store **starts empty when
   configured** and never writes localStorage in that mode.
3. Sync `flush` cleared the dirty set before pushing → **offline mutations were lost**; and `hydrate` had
   no dirty/in-flight guard → a realtime/reconnect hydrate **wiped optimistic edits** and the pending push
   then wrote the emptied day back. Added in-flight protection, requeue-on-failure, and a reconnect retry.
4. Mutations made during the activation window weren't recorded (marker gated on `active`) → lost. Now
   recorded whenever Supabase is configured.
5. Activation didn't retry if interrupted (offline during bootstrap). Added an `online` re-activation.
6. `subscribeHousehold` reused a fixed channel name → "cannot add callbacks after subscribe()" on
   re-activation (StrictMode) → activation threw. Unique channel name per subscription.
7. `WeighInForm` inputs had **no associated labels** (a11y defect) and reset on every background hydrate.
   Labels now wrap their inputs; reset keyed on open only.
8. Realtime didn't deliver to a second session **against the remote** (worked locally): the realtime
   socket lacked its auth token, so RLS blocked `postgres_changes`. `subscribeHousehold` now calls
   `realtime.setAuth(token)` before subscribing. Verified two-context realtime against the remote.

### Remote E2E verification (2026-07-24)

Each capability was verified in the browser against the **remote** project in isolation: built-in AND
custom food favorites/recents sync (per-profile separation), custom food sync, refresh persistence,
session lifecycle, two-context realtime, and offline+reconnect. Running the entire 10-spec suite in a
single pass against the remote is limited by **environmental** factors — GoTrue sign-up rate-limiting
(~15 fresh accounts/run) and occasional `PGRST303 "JWT issued at future"` clock skew — not product bugs;
the app's activation-retry absorbs the transient auth failures. The full 10-spec suite runs green against
the local Supabase stack (identical, complete schema). Recommended for CI: run E2E against a dedicated
project (or local) to avoid shared-project rate limits.

## Remaining limitation

Authenticated browser smoke verification **by Claude was not performed**, because the household
account's credentials were unavailable and creating a throwaway account would have added a second
household to the clean pilot project. Not observed by Claude in an authenticated session: visible
switching between אריאל and אלנה, adding a food through the real UI, refresh persistence through the
user account, and live Recent/Favorite behaviour through the user account. All of it is covered by
automated tests at the logic and component level.

This will be completed naturally through the user's first real interaction. **It is not a database or
deployment blocker.**

## Active risks

1. **R1** — The first authenticated UI interaction has not yet been directly observed by Claude.
2. **R2** — The user may discover a UI-only issue during first use.
3. **R3** — The successful bootstrap SQL must not be rerun unnecessarily (DEC-021). Troubleshooting uses
   `supabase/verify_catalog.sql`, which is read-only.
4. **R4** — Future schema or seed changes must continue through new forward-only migrations, never by
   editing the applied one or re-running it.

Non-blocking, carried over: bottom-nav "history"/"more" and the quick-add default slot are
placeholders; the full 10-spec Playwright suite must run against a dedicated project, never against
this one (it signs up `e2e_*` accounts, which would create extra households).

## First next step

`Use the application for the first real meal entry. Confirm profile switching, food search, saving, and persistence after refresh. If a problem appears, capture the visible behavior and continue from the current production baseline without rerunning migrations.`

## Session closure — 2026-07-25

- Production bootstrap completed.
- Catalog seeded with 390 foods.
- Database baseline verified `READY`.
- Documentation reconciled.
- First real use is the next milestone.
- No user technical action remains.
