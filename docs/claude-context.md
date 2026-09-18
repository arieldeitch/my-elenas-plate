# Claude Context

Fast-start context for Claude Code. The latest user instruction always overrides older docs.
Updated 2026-09-18.

## Start state

- **Project:** shared Nutrition Tracker for **אריאל (Ariel)** and **אלנה (Elena)** — Hebrew, RTL,
  mobile-first daily logging.
- **Branch:** `main` (M1 merged 2026-09-18; fail-safe runtime + preflight + M2 step 1 the same day).
  M1 status: `docs/claude-tasks/M1_STATUS.md`; latest run record:
  `docs/claude-tasks/RUN_2026-09-18_M2_PREP.md` (previous: `RUN_2026-09-18_M1_PROMOTION.md`).
- **Supabase project:** `rqgoiuztphkcvbwtbxbj` (production). Isolated test branch
  `m1-shared-truth-test` (`uyroeumwmjhrcbkesmgb`).
- **Production DB status:** bootstrap complete, catalog seeded. **Pending:** the reviewed grants
  migration `20260916120000_grant_table_privileges.sql` is **not yet applied to production** — see
  `supabase/DEPLOY.md` §"M1 release" (needs the production owner's Supabase access; not reachable from a
  Claude session, DEC-024).
- **Fail-safe since 2026-09-18 (DEC-025):** a production build without Supabase config is now
  **blocked** (`RuntimeGate`), `.env.production` is committed with the public URL/target and one
  line for the key, every build emits `/build-info.json`, and `npm run preflight -- --env|--local|--live`
  is the executable release gate (`docs/RUNTIME_CONFIG.md` §1a, §2a, §2b, §3).
- **LIVE APP IS IN DEMO MODE (found 2026-09-18, DEC-024).** The published site
  `https://my-elenas-plate.lovable.app` (Lovable project `ca9aedab-a0ca-4889-a545-9d673febf3a0`,
  `x-deployment-id 0c0eb717…`) was built **without** `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`: its
  bundle compiles `isSupabaseConfigured()` to `false`. Every entry Ariel and Elena log there stays in that
  phone's localStorage; **nothing reaches Supabase and nothing is shared**. M1 cannot be live until the
  two public env values are set in the Lovable project and a publish is made. Do not describe production
  as "shared" or "verified" until `docs/RUNTIME_CONFIG.md §4` passes on the published URL.
- **Toolchain (2026-09-18):** install with `bun install --frozen-lockfile` (npm resolves newer
  TanStack packages and breaks `tsc`); on Windows set `git config core.autocrlf false` in this repo
  (CRLF checkouts fail `catalog-seed.test.ts` and prettier). Docker is never required
  (`docs/NO_LOCAL_DOCKER_POLICY.md`; `.claude/settings.json` denies Docker-launching commands).
- **T-034 (2026-08-01): closed as Backend Verified** (DEC-023). Production RLS confirmed enforced
  (11/11 anonymous probes rejected, read-only). Data layer confirmed by **12/12 gated live tests**
  against a local stack with identical migrations. One flaky realtime _test_ was fixed (DEC-022); no
  product code, schema, RLS or migration changed.
- **T-034-UI: Blocked.** The browser-dependent half (profiles rendering, profile switching, on-screen
  search, adding an entry through the real UI, refresh persistence) runs only when a browser automation
  capability exists. **Never describe T-034 as fully verified until T-034-UI is done.**
- **Do not build a production self-test** (DEC-023) — no diagnostics tables, feature flags, background
  self-tests, temporary migrations, diagnostic entities, production writes, or deployment-only
  verification code. This was considered and rejected.
- **Deployment: there is no automated pipeline.** Re-verified 2026-09-18 — no `.github/workflows`,
  zero GitHub Actions runs, zero GitHub deployments, no `deploy` script. **Pushing to `main` deploys
  nothing.** This is a Lovable project (Lovable's `gpt-engineer-app[bot]` commits land on `main`, so
  `main` is the connected branch); publishing is a manual action in the Lovable editor, in Ariel's
  Lovable account (not the account connected to Claude's MCP). Production URL:
  `https://my-elenas-plate.lovable.app` — read-only checks are possible with `curl`
  (`docs/RUNTIME_CONFIG.md §4`), authenticated UI checks need a browser session.

## Verified production baseline (2026-07-25)

| households | memberships | profiles | meal slots | RLS tables | active foods | transactional logs | status    |
| ---------- | ----------- | -------- | ---------- | ---------- | ------------ | ------------------ | --------- |
| 1          | 2           | 2        | 6          | 10         | **390**      | 0                  | **READY** |

## Important instructions

- **Do not rerun the bootstrap migration** (DEC-021 — it is historical and applied).
- Do not reset or reseed the database.
- Do not recreate demo data.
- Do not assume the user needs to run SQL. They do not.
- Supabase is the source of truth.
- Preserve the household and both profiles.
- Preserve the 390-item catalog.
- Out of scope: calories, macros, goals, gamification, dashboard, recommendations, voice,
  image recognition, wearables, Agents.
- Avoid unrelated refactors.

Why the first SQL report showed zeros (so a future session does not misread it): the catalog seed
inserts one row **per household** (`from public.households h cross join catalog c`), and the project
had the full schema but no household, because `bootstrap_household()` only runs on sign-in and had
never run there. `supabase/bootstrap_and_seed.sql` created the household/membership/profiles and then
seeded. Nothing was ever broken in the migration.

## Important files

- `supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql` (applied)
- `supabase/bootstrap_and_seed.sql` (applied) · `supabase/verify_catalog.sql` (read-only checks)
- `src/data/foods/` · `src/lib/food-normalize.ts` · `src/lib/food-search.ts`
- `docs/project-status.md` · `docs/todo.md` · `docs/decisions.md` · `docs/gpt-handover.md`

## First action for the next session

Not a repository audit, and not a migration:

1. Read `docs/claude-context.md`.
2. Read `docs/claude-tasks/RUN_2026-09-18_M2_PREP.md` (latest run record + blockers).
3. Read `docs/project-status.md` and `docs/todo.md`.
4. Check the current branch, HEAD and `git status` (read-only).
5. **M1 release is blocked on two actions only Ariel can do** (see the latest run record §"YOU"):
   add the anon/publishable key line to the committed `.env.production` + publish from Lovable
   (DEC-025; the published build is BLOCKED by `RuntimeGate` until then), and apply the grants
   migration to production. `npm run preflight -- --live` is the pass/fail check for the publish. Verify each with the read-only checks in `docs/RUNTIME_CONFIG.md §4` and
   `supabase/verify_privileges.sql`; then run the live M1 acceptance (T-034-UI + run record §"LIVE
   ACCEPTANCE") if a browser session is available. Otherwise leave them open and say so plainly.
6. **Do not reopen T-034** — closed as Backend Verified (DEC-023). Do not propose a production self-test
   or diagnostics table (DEC-023).
7. Never rerun the bootstrap as a troubleshooting shortcut — use `supabase/verify_catalog.sql`.
8. Do not re-run the gated live suites against production — they sign up accounts and would create
   extra households. Run them **only** against the isolated hosted branch (`SUPABASE_TEST_URL` /
   `SUPABASE_TEST_ANON_KEY`, `.env.e2e`). **Never `supabase start` / local Docker**
   (`docs/NO_LOCAL_DOCKER_POLICY.md`).
9. Never run a plain `supabase db push` against production: its ledger lacks `20260725190000`, so push
   would re-run the cleanup/seed migration (DEC-021). Use `supabase/DEPLOY.md` §"M1 release".

## Known limitation

Claude has **not** authenticated through the user's account, so profile switching, adding a food in the
real UI, refresh persistence and live Recent/Favorite behaviour were never observed in an authenticated
browser session (they are covered by automated tests). **Do not request the password.** If authenticated
UI testing becomes necessary, give the user one minimal in-app action, or use an approved session
mechanism that does not expose credentials.

## What this is

A Hebrew, RTL, mobile-first shared **nutrition logging** app for two people. Goal: fast, calm,
non-judgmental daily logging — NOT analysis. No calories, macros, goals, scoring, dashboard,
recommendations, or gamification.

## Current product truth (overrides older wording)

- **Profiles:** `אריאל` and `אלנה`. Never display "אני". (Internal ids remain `me` / `elena`.)
- **Six meal slots** (order + labels are fixed):
  1. פתיחת חלון אכילה (`breakfast`)
  2. נשנוש ראשון (`morning_snack`)
  3. ארוחה מרכזית (`lunch`)
  4. נשנוש אחר הצהריים (`afternoon_snack`)
  5. ארוחת ערב (`dinner`)
  6. ארוחה נוספת (`late`)
- **"ארוחת לילה" is removed** — must not appear. (The internal slot id is still `late`; only the label changed.)
- **Daily completeness = the six slots only.** A slot is `empty` / `logged` / `skipped`; `skipped`
  counts as complete and is reversible. Fasting, workout, weigh-in and coffee do **not** affect
  completeness unless represented as a meal entry.
- Both users follow 16:8; the wording reflects an eating window, not fixed meal times.

## Coffee (approved MVP feature)

- Coffee is a **normal food entry** (`foodId: "f_coffee"`, `Food.kind: "coffee"`) with structured
  attributes on `FoodEntry.coffee: CoffeeMeta` — not free text.
- `CoffeeMeta = { type, milk, milkType?, note? }`.
  - `type`: אספרסו / אספרסו כפול / אמריקנו / קפה שחור / נס קפה / קפוצ׳ינו / לאטה / פילטר / אחר.
  - `milk`: ללא חלב / עם חלב. `milkType` only valid with עם חלב (חלב רגיל / דל שומן / ללא לקטוז /
    סויה / שקדים / שיבולת שועל / אחר) and is **cleared** when switching back to ללא חלב.
  - Quantity uses the measured model with coffee units (כוס / ספל / יחידה / מ״ל).
- Logic lives in `src/lib/coffee.ts` (`validateCoffee`, `normalizeCoffee`, `coffeeSummary`), fully
  unit-tested. UI: `CoffeeSelector.tsx`, opened from the food search "הוספת קפה מהירה" button or by
  picking the קפה food; defaults (אמריקנו · ללא חלב · כוס) allow one-tap add.

## Architecture map (where things live)

- Domain types + constants: `src/lib/domain.ts`.
- Pure logic (tested): `completion.ts`, `coffee.ts`, `fasting.ts`, `weight.ts`, `quantity.ts`,
  `food-normalize.ts`, `food-search.ts`.
- App state: `src/lib/store.tsx` (React context, repository-like API). When Supabase is configured it is
  the source of truth (store starts EMPTY, hydrates from the cloud); `src/lib/persistence.ts`
  (localStorage) is read ONLY in demo mode. Sync glue: `src/lib/sync/*`.
- **No demo/mock seed exists any more** — `src/lib/demo-data.ts` was deleted (2026-07-25) and all
  tracking state starts empty in every mode. The one-time localStorage→cloud import is disabled
  (`LOCAL_IMPORT_ENABLED = false` in `use-supabase-sync.tsx`) so a stale local snapshot cannot
  repopulate the cloud. Don't reintroduce either.
- Food catalog: 390 items in category modules `src/data/foods/*.ts`; app entry point
  `src/lib/food-catalog.ts` (`BUILT_IN_FOODS`, `mergeCatalog`). Supabase `public.foods` is the source
  of truth and supersedes the bundled item by `normalized_name`; the bundle is the offline / pre-seed
  fallback (DEC-019). Seed SQL is generated by `npm run catalog:seed` and guarded by
  `src/lib/catalog-seed.test.ts` — edit the TS modules, never the generated SQL block.
- UI: `src/components/nutrition/*`, home route `src/routes/index.tsx`, shell `src/routes/__root.tsx`.

## Backend reality

**Supabase implemented, opt-in via env (2026-07-23).** Model: one shared Auth account, two internal
profiles (אריאל `ariel` / אלנה `alena`), data separated by `profile_id`; the shared account edits both.
Migrations under `supabase/` (schema + RLS + bootstrap + realtime) were live-verified against a local
Supabase stack (RLS isolation + bootstrap: 5/5 integration tests). App layer: `src/lib/supabase/*`,
`src/lib/sync/*`, `src/components/auth/*`, wired into the store behind `isSupabaseConfigured()`.
Without `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` the app runs in **local demo mode** (localStorage).
Never put service_role in the client. Remote project `rqgoiuztphkcvbwtbxbj` is set in `.env`, schema
applied, and **live-verified end-to-end** (2 gated suites, 10/10 vs remote): auth/session, bootstrap
(אריאל/אלנה, idempotent), RLS isolation, CRUD on all tables, coffee round-trip + CHECK, idempotency,
local→cloud migration, two-context realtime. **T-027 done:** `useSupabaseSync` also syncs custom foods
(`foods`) + favorites/recents (`food_preferences`, per profile) with optimistic UI, dirty-tracking,
realtime and offline queue; migration `090400` made `food_preferences.food_id` a text app-id (DEC-018).
Remote deployment is COMPLETE: migration `090400` (food_id→text) is applied to the remote, so built-in AND
custom food favorites/recents sync there (verified live in the browser). **T-028 done:** Playwright browser
E2E (`npm run e2e`, 10 specs) against a live Supabase (`.env.e2e` → local stack, else remote); it found +
fixed 8 production-readiness bugs incl. realtime auth-token on the socket (see project-status). Full suite
green vs local; each capability verified vs remote (single full-suite remote run is rate-limit/clock bound).
In configured mode the store starts EMPTY and hydrates from the cloud (no demo-seed pollution); never
writes localStorage. Tests stay hermetic via `vi.stubEnv` in
`src/test/setup.ts`; the live suites (`*.integration.test.ts`) skip unless
`SUPABASE_TEST_URL/ANON_KEY/EMAIL_DOMAIN` are set. See DEC-017/DEC-018 and `project-status.md`.

## Guardrails

- Mobile-first, RTL, large touch targets, no color-only status, calm/neutral tone.
- Home stays compact: large meal icons, **no food details on the home tiles**.
- Don't add out-of-scope analytics features. Follow the global Approval-Brief rule before any
  Supabase/auth/RLS/schema/migration/secret/env change.

## Quality gate

`tsc --noEmit`, `eslint .` (0 errors, 8 dev-only HMR warnings), `vitest run` (**186 passed**, 2 gated
live suites skipped without env), `vitest-axe` (0 violations) and `vite build` — all green as of
2026-07-25. `npm run e2e` (Playwright, 10 specs) is intentionally **not** run against the pilot
project: it signs up fresh `e2e_*` accounts, which would create extra households. Test tooling: Vitest + Testing
Library + vitest-axe + Playwright; `npm run coverage` for the report. See `project-status.md` for the
full table and `decisions.md` for the rationale of recent changes.
