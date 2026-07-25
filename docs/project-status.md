# Project Status

**Date:** 2026-07-25 (production catalog applied to Supabase)
**Branch:** main
**Commit before this work started:** `2dfe91e` (docs(handover): reconcile with Lovable's branding illustration)
**Pilot-ready checkpoint:** tag `pilot-ready-2026-07-24` → `29ac1d5` (verified backend + E2E code).
**Phase:** **Ready for the pilot.** Full Supabase backend implemented and deployed; MVP hardening,
coffee, favorites/recents/custom foods and browser E2E complete. The 390-item Hebrew catalog, Hebrew
normalization and duplicate prevention are implemented, tested, and **live in project
`rqgoiuztphkcvbwtbxbj`**: 1 household, 2 profiles (אריאל/אלנה), 390 active foods, RLS on all 10 tables,
zero tracking data. Remaining confirmation is the first real log in the browser on 2026-07-26.

> Rule: nothing is listed as "working" unless it was actually run/verified.

## 2026-07-25 — DATABASE APPLIED. Catalog live in Supabase.

### Applied result (verified by the user in the SQL Editor, project `rqgoiuztphkcvbwtbxbj`)

`supabase/bootstrap_and_seed.sql` was run once. Final report:

| check | value |
| --- | --- |
| households | 1 |
| household_memberships | 2 |
| profiles_ariel_alena | 2 |
| meal_slots_defined | 6 |
| tables_with_rls | 10 |
| foods_active (`result`) | **390** |
| weigh_ins | 0 |
| **status** | **READY** |

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

- **390 items**, 11 category modules under `src/data/foods/` (`vegetables`, `fruits`,
  `dairy-and-eggs`, `breads-and-grains`, `legumes`, `meat-and-fish`, `dishes`,
  `snacks-and-sweets`, `drinks`, `condiments`, plus `types` + `index`).
- Per-category counts: ירקות ועשבי תיבול 45 · פירות 36 · מוצרי חלב ותחליפים 28 · ביצים 7 ·
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

| Path | Action |
| --- | --- |
| `src/lib/demo-data.ts` (fake days, weigh-ins, favorites, recents, fasting, workout) | **Deleted** |
| `store.tsx` seeding of days/weighIns/favorites/recents | **Removed** — starts empty in every mode |
| `store.tsx` localStorage hydration in configured mode | **Guarded** — demo mode only |
| localStorage→cloud one-time import | **Disabled** (`LOCAL_IMPORT_ENABLED = false`) so a stale demo snapshot cannot repopulate the cloud after cleanup |
| Old 23-item client catalog + weak `normalize` | **Replaced** by `src/data/foods/*` + `food-normalize.ts` |

Legitimate test fixtures were kept. Tests that had asserted against the demo seed
(`WeightBanner`, `FastingCard`, `WorkoutCard`) now create their own data through the store API.

### Cleanup + seed migration (written, NOT applied)

`supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql`

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

| Suite | Tests | Covers |
| --- | --- | --- |
| `food-normalize.test.ts` | 11 | geresh/apostrophe variants, niqqud, ktiv male, separators, punctuation, Latin case, idempotency, false-merge guards (`פטה`≠`פיתה`) |
| `food-catalog.test.ts` | 25 | ≥300 items, no blank/duplicate normalized names, unique `f_*` ids, valid units, default ∈ allowed, ≥15 distinct unit sets, all categories used & populated, no nutrition/favorite fields, no placeholder or numbered names, one coffee-kind food, 13 checklist searches, ranking, result cap, `mergeCatalog` supersede/archive/dedupe |
| `catalog-seed.test.ts` | 16 | SQL is the current generated form, one row per item, idempotent upsert, seeds every household, writes no preferences/entries, schema-only columns, no RLS/policy/TRUNCATE/auth changes, no unqualified DELETE, delete-target allowlist, fingerprint & epoch presence, before/after reporting |
| `store.test.tsx` (extended) | +6 | empty start for both profiles, catalog exposed with no preferences, normalized-duplicate reuse, genuine custom food still created, favorite only on request, recent only after logging, per-profile separation |
| `MealEditor.test.tsx` (extended) | +5 | favorites/recents empty until use, capped results, subjective mode, food-specific units (פרוסה not חצי יחידה), apostrophe duplicate resolves to the catalog item |

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

## Quality gate (run this session)

| Check                     | Command                                   | Result                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check                | `tsc --noEmit`                            | PASS — 0 errors                                                                                                                                                                                                         |
| Lint                      | `eslint .`                                | PASS — 0 errors, 8 warnings (see "Remaining warnings" below)                                                                                                                                                            |
| Format                    | `prettier`                                | PASS — changed + previously-unformatted source files normalised; `endOfLine: auto` added for cross-platform CRLF                                                                                                        |
| Unit/integration tests    | `vitest run`                              | PASS — 109 passed / 12 skipped (2 live suites, no env)                                                                                                                                                                  |
| Live DB (RLS + bootstrap) | `supabase start` + gated integration test | PASS — 5/5 against local Supabase (bootstrap, isolation, anon-denied, coffee CHECK)                                                                                                                                     |
| Live remote (RLS+CRUD+RT) | 2 gated suites vs remote project          | PASS — 12/12 (auth, bootstrap, RLS isolation, CRUD all tables, coffee, idempotency, migration, custom foods + favorites/recents + isolation, 2-context realtime)                                                        |
| Migration validation      | `psql < each migration`                   | PASS — all 5 apply cleanly (10 tables, 35 policies, 8 realtime tables; food_id->text)                                                                                                                                   |
| Generated types           | `supabase gen types --local`              | Matches hand-derived aliases; committed as `database.generated.ts`                                                                                                                                                      |
| Accessibility             | `vitest-axe` on 5 key components          | PASS — 0 violations (MealCard, CoffeeSelector, ProfileSwitcher, DailyCompletionIndicator, WeightBanner)                                                                                                                 |
| Browser E2E               | `playwright test` (`npm run e2e`)         | PASS — 10 specs vs live Supabase (auth/RTL/mobile, meal+coffee CRUD, custom + built-in foods/favorites/recents, fasting/workout/weigh-in, profile separation, session lifecycle, 2-context realtime, offline+reconnect) |
| Build                     | `vite build`                              | PASS — SSR + client build succeeds                                                                                                                                                                                      |
| SSR smoke                 | `vite dev` + curl                         | PASS — Home renders; profiles אריאל/אלנה, six slots, RTL; no "אני", no "ארוחת לילה"; no hydration warnings                                                                                                              |
| Secret scan               | grep                                      | PASS — no secrets, no `.env`, no service_role                                                                                                                                                                           |

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

## Not present / not yet live-verified (honest gaps)

- **Browser end-to-end of the live app** (magic-link/password sign-in → realtime across two sessions) is
  not automated — verified at the SQL/RLS/repository layer, not through the running browser app. This
  needs real project credentials (or the local stack) + a manual/E2E pass.
- No E2E framework (Playwright) — component/integration coverage via Vitest + Testing Library instead.
- Bottom-nav "history"/"more" and quick-add default slot are placeholders.

## Risks

- R1 — Persistence is local-only; a new device / cleared storage starts empty. Real multi-device sync needs Supabase.
- R2 — SSR hydration renders the seed first, then swaps to persisted state on mount (brief, expected).
- R4 — Single source for day completeness is `src/lib/completion.ts`, shared by home + calendar (good).

## Next step

The Supabase backend is implemented, deployed to the remote, and verified — the project is
**pilot-ready** (tag `pilot-ready-2026-07-24`). Recommended next task: **add Playwright E2E to CI
against a dedicated Supabase project** (not the shared pilot project) so the full 10-spec suite runs
green in one pass without the sign-up rate-limit / clock-skew flakiness. Then run the actual 2-person
pilot and, separately, the branding illustration pass (see the Branding section and `gpt-handover.md`
§10–11). Open backlog is in `todo.md`.
