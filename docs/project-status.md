# Project Status

**Date:** 2026-07-23
**Branch:** main
**Commit before this work:** 542233e (Update site info for publish)
**Phase:** MVP hardening — verified implementation, coffee feature, tests added.

> Rule: nothing is listed as "working" unless it was actually run/verified in this session.

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

| Check                     | Command                                   | Result                                                                                                             |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Type check                | `tsc --noEmit`                            | PASS — 0 errors                                                                                                    |
| Lint                      | `eslint .`                                | PASS — 0 errors, 8 warnings (see "Remaining warnings" below)                                                       |
| Format                    | `prettier`                                | PASS — changed + previously-unformatted source files normalised; `endOfLine: auto` added for cross-platform CRLF   |
| Unit/integration tests    | `vitest run`                              | PASS — 102 passed / 5 skipped (live RLS, no env)                                                                   |
| Live DB (RLS + bootstrap) | `supabase start` + gated integration test | PASS — 5/5 against local Supabase (bootstrap, isolation, anon-denied, coffee CHECK)                                |
| Live remote (RLS+CRUD+RT) | 2 gated suites vs remote project          | PASS — 10/10 (auth, bootstrap, RLS isolation, CRUD all tables, coffee, idempotency, migration, 2-context realtime) |
| Migration validation      | `psql < each migration`                   | PASS — all 4 apply cleanly (10 tables, 35 policies, 8 realtime tables)                                             |
| Generated types           | `supabase gen types --local`              | Matches hand-derived aliases; committed as `database.generated.ts`                                                 |
| Accessibility             | `vitest-axe` on 5 key components          | PASS — 0 violations (MealCard, CoffeeSelector, ProfileSwitcher, DailyCompletionIndicator, WeightBanner)            |
| Build                     | `vite build`                              | PASS — SSR + client build succeeds                                                                                 |
| SSR smoke                 | `vite dev` + curl                         | PASS — Home renders; profiles אריאל/אלנה, six slots, RTL; no "אני", no "ארוחת לילה"; no hydration warnings         |
| Secret scan               | grep                                      | PASS — no secrets, no `.env`, no service_role                                                                      |

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

### Honest gaps in the live pass

- **App sync scope**: `useSupabaseSync` currently pushes **days** (meal statuses + food entries incl.
  coffee + fasting + workout) and **weigh-ins**. **Favorites, recents and custom foods stay client-local**
  — the `food_preferences`/`foods` tables exist and were CRUD-verified directly, but the app's sync hook
  does not yet write them. Follow-up: extend the sync to preferences/foods.
- **Browser UI E2E** (Playwright driving SignIn → MealEditor → … against remote) and **browser-level
  offline** (network throttle in a real browser) are **not automated**. Coverage is instead: the live
  data-layer suites against the real remote (same mappers/migration/RLS the app uses) + hermetic component
  tests + the app booting and gating correctly against the remote. Adding Playwright is the recommended
  next step; risk is low since each layer is independently verified.

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

Connect Supabase (schema per `docs/03-architecture.md`) behind the existing store API and replace the localStorage layer; keep the pure domain modules (`completion`, `coffee`, `fasting`, `weight`, `quantity`) as the shared logic.
