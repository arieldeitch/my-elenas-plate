# Project Status

**Date:** 2026-07-24 (end-of-day handover, back to Lovable)
**Branch:** main
**Commit before this work started:** 542233e (Update site info for publish)
**Pilot-ready checkpoint:** tag `pilot-ready-2026-07-24` → `29ac1d5` (verified backend + E2E code).
**Current `main`:** merge integrating Lovable's branding work (added after the checkpoint) with this
handover; tree green (tsc 0, 109 tests, build).
**Phase:** **Pilot-ready.** Full Supabase backend implemented, deployed to the remote and verified;
MVP hardening, coffee, favorites/recents/custom foods, and browser E2E complete. Brand illustration added.

> Rule: nothing is listed as "working" unless it was actually run/verified.

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
