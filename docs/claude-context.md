# Claude Context

Fast-start context for Claude Code. The latest user instruction always overrides older docs.
Updated 2026-09-22 (DEC-036 reference-only foods merged to `main`; migration 20260922090000 prepared + proven on PGlite, NOT applied to production; DEC-035 migration IS applied and live on `919f75e`).

## Start state

- **Project:** shared Nutrition Tracker for **אריאל (Ariel)** and **אלנה (Elena)** — Hebrew, RTL,
  mobile-first daily logging.
- **Branch:** `main` (M1 merged; fail-safe runtime + preflight; M2 steps 1–6 — all 2026-09-18).
  M1 status: `docs/claude-tasks/M1_STATUS.md`; **M1 release entrypoint:**
  `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`; latest run record:
  `docs/claude-tasks/RUN_2026-09-19_POINTS_V2_HARDENING.md` (previous: `RUN_2026-09-19_STEPS_UX.md`, `RUN_2026-09-18_RELIABILITY_HARDENING.md`).
- **DEC-036 (2026-09-22) — the reference is the ONLY source of the food list (`docs/POINTS_REFERENCE.md §0`).**
  `src/lib/points-reference/canonical.ts` builds the active list from the reference alone
  (`resolveCatalog`); legacy catalog foods appear only through explicit link / verified alias
  (`src/data/points-reference/aliases.v1.json`, 76) / exact name, as the reference card (`r_*`,
  one canonical id), otherwise hidden (235). No points fallback: unresolved entries are saved
  UNSCORED (`pointsValue null`, `ref-v1`), never estimated; custom foods are personal aliases
  (`store.addPersonalAlias`, `PersonalAliasForm`) of reference foods. Favourites/recents/edit/copy go
  through `store.resolveFoodId`. Coffee scores via `coffeeReferenceGroup`. Migration
  `20260922090000_reference_only_foods` (+ `apply_reference_only_foods_production.sql`,
  `verify_reference_only_foods.sql`) is an owner gate; the client refuses to create personal aliases
  until the column exists. Run record: `docs/claude-tasks/RUN_2026-09-22_REFERENCE_ONLY_FOODS.md`.
- **DEC-035 (2026-09-21) — canonical points reference (`docs/POINTS_REFERENCE.md`).** Elena's sheet
  `docs/data/nutrition-points-source.xlsx` → `npm run points:import` → `src/data/points-reference/`
  (audit `reference.v1.json` with verbatim `source_*`, runtime `reference.v1.runtime.json`, reports).
  `src/lib/points-reference/` = parser, cleaning rules R01–R11, engine (exact → alias → same-family
  scaling → blocked; half points; benefits base vs applied), runtime index (`withReference` links catalog
  foods by exact normalised name and adds reference-only `r_*` foods). `scoreEntry(entry, food, ctx)` in
  `points.ts`: reference row → confirmed custom portion → v2-il, basis stored on the entry. Conflict /
  needs_review rows are never offered or scored. UI: result line, `VariantPicker`, reference-aware
  `QuantitySelector`, `NewFoodForm` (confirm before save, `הצעה לבדיקה`). Migration
  `20260921120000_points_reference` + `apply_points_reference_production.sql` + `verify_points_reference.sql`
  (owner gate, `supabase/DEPLOY.md`). Never edit the JSON / seed by hand: edit the sheet, bump
  `SOURCE_VERSION`, re-run the three `points:*` scripts.
- **DEC-034 (2026-09-19) supersedes the v1 model.** `src/lib/points-config.ts` holds EVERY constant
  (category table, subjective multipliers, unit families/portions, nutrition weights, budget: Mifflin-St
  Jeor → 23 × BMR/1400, clamp 14–45, maintenance ×1.2, fallback 23, override 10–60); `src/lib/points.ts`
  is the pure engine (`calculatePointsV2`, `scoreEntry`, `pointsForEntry` = persisted snapshot wins,
  `resolvePointsBudget`, `ageFromBirthDate`, `latestWeightKg`). Vegetables 0 always (plain salads are
  calibrated 0 via `FoodDef.pointsPerPortion`), fruit 1/portion. Profile facts (sex/birth date/height/
  goal/override) live on `profiles` — migration `20260919100000` **applied + verified on production 2026-09-19**; no facts were guessed and old point snapshots were untouched. `supabase/apply_points_v2_production.sql` / `supabase/verify_points_v2.sql` remain as deployment evidence. Lovable publish was triggered after the apply; phone acceptance is next. Elena calibrates via the table in the run record; never ask for proprietary formulas.
- **DEC-033 is implemented on main (2026-09-19).** Typed search opens QuantitySelector; favourite/recent chips keep trusted quick add. Quantity UI is measured or subjective with explicit units. Keyboard safety has no smooth/delayed post-open recenter. Internal points v1 uses transparent category×portion rules, persists entry snapshots, and has a synced per-profile daily budget. Production migration `20260919082000_internal_points_v1` is applied and verified; publish + phone acceptance remain. It is NOT Weight Watchers' formula and adds no calories/macros.
- **DEC-032 is implemented (2026-09-19).** The daily loop now uses a calmer palette, three-action bottom
  navigation, a four-tile context grid (weight/workout/fasting/steps), and shared daily steps with exact
  or completed-only reporting. The steps row is keyed by profile/date, carries a goal snapshot, uses the
  durable narrow-operation queue and Realtime, and always follows `selectedDate`. The reviewed migration
  is `supabase/migrations/20260919044237_daily_steps.sql`; production still requires the dedicated apply
  wrapper and read-only verification in `supabase/DEPLOY.md`. Never run plain `supabase db push`.
- **Feature work was paused (2026-09-18).** The daily loop is considered ready for first real use. Do
  not build M2-8; it will be selected from the pilot's friction log (`docs/claude-tasks/M2_7_PILOT.md`).
  **Owner actions A/B/C are complete; §2 PASSED on the served `0cd3673`; §3 item 9 PASSES — but that
  build shows a login screen, which DEC-031 (2026-09-18) removed as a product regression.** Access
  now: silent anonymous device session (`AuthGate` → `ensureSession()`), `bootstrap_household()`
  joins the ONE household, person = device profile. **State 2026-09-18 17:45:** DEC-031 migration
  applied + verified on production by the controlling GPT; no-login build `fd32a38` live (preflight
  PASS); `main` is ahead by the eleventh-run hardening (auth races, perf, mobile/a11y — republish
  wanted); **Auth "Allow anonymous sign-ins" is still OFF** (probe: `POST /auth/v1/signup {}` →
  `422 anonymous_provider_disabled`; nothing is created while OFF). Next run: probe the switch; when
  ON → fresh-device production smoke (no form → chooser → footer `· cloud`; reload reuses the session;
  one membership) → `npm run preflight -- --live` on the republished sha → §3b reply → mark M1 CLOSED,
  start the pilot. If a §3b item fails, fix only that. No M2-8. Never ask Ariel for
  Supabase/GitHub/Lovable actions. Post-pilot: `apply_hardening_post_pilot.sql` (M1-R8).
- **Home (M2, DEC-026/027/032):** `TodayCard` (me) → `PartnerGlance` (partner) → six compact `MealCard`s →
  `DailyContextRow` (weight · workout · fasting · steps, inline editors). `DayReview` sheet (DEC-028) opens from
  the today card / partner card: read-only day per slot for either person; edit only for the active
  person; looking never switches person or date. Meal-editor rows have a − / + pill for count units only
  (DEC-029; `lib/quantity.ts` `COUNT_UNITS`, `stepAmount`, `formatQuantity`). Under DEC-033,
  typed search results always open QuantitySelector so measured/subjective + unit choice is explicit;
  favourite/recent chips may quick-add only when `usualQuantity(food)` is trusted. Visual check: `scripts/home-snapshots.mjs`
  against `npx vite dev --mode hermetic --port 4336` (screenshots + page height + above-the-fold report).
  One-screen `MealEditor` with one-tap quick add from favourites/recents. Personal colours on
  `PROFILES` (`color`/`tint`); `data-owner` on the today card and the editor dialog. No calories/macros
  anywhere (DEC-004) — do not add them to the partner card.
- **Supabase project:** `rqgoiuztphkcvbwtbxbj` (production). Isolated test branch
  `m1-shared-truth-test` (`uyroeumwmjhrcbkesmgb`).
- **Production DB status:** bootstrap complete, catalog seeded. The reviewed M1 grants/default
  privileges are applied to production and verified. The migration ledger contains both
  `20260725190000` and `20260916120000`; all 10 public tables have RLS enabled; authenticated/service_role
  have the required table privileges. Owner action C is complete.
- **Fail-safe since 2026-09-18 (DEC-025):** a production build without Supabase config is now
  **blocked** (`RuntimeGate`), `.env.production` is committed with the public URL/target and one
  line for the key, every build emits `/build-info.json`, and `npm run preflight -- --env|--local|--live`
  is the executable release gate (`docs/RUNTIME_CONFIG.md` §1a, §2a, §2b, §3).
- **Production release state (verified 2026-09-18, ninth run):** <https://my-elenas-plate.lovable.app>
  serves `main` `0cd3673` (deployment `psr2.4acecc14…`) — `mode=cloud`, `target=shared`,
  `misconfigured=false`, host `rqgoiuztphkcvbwtbxbj`, no secrets: `PREFLIGHT PASS — 14 checks`.
  Anonymous REST reads `[]` on all 10 tables, anonymous insert rejected by RLS. The old `0c0eb717…`
  demo deployment is history. Since DEC-031 that served build is **behind `main`** (it still shows
  the login); anonymous sign-ins were OFF on production at 15:50 (`422 anonymous_provider_disabled`).
  Do not mark M1 CLOSED until the republished build passes preflight and the §3b reply is in.
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
2. Read `docs/claude-tasks/RUN_2026-09-22_REFERENCE_ONLY_FOODS.md` (latest run record; previous `RUN_2026-09-21_POINTS_REFERENCE.md`) and
   `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md` (release state).
3. Read `docs/project-status.md` and `docs/todo.md`.
4. Check the current branch, HEAD and `git status` (read-only).
5. **M1 release:** everything — owner actions, the automated check (`npm run preflight -- --live`),
   the DB check and the ten live acceptance items — is in ONE place:
   `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`. Run §2 first; if it passes, do §3 only with an
   authenticated browser session. Do not re-explain the blockers elsewhere. Verify each with the read-only checks in `docs/RUNTIME_CONFIG.md §4` and
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

**Supabase implemented, opt-in via env (2026-07-23; access model changed 2026-09-18, DEC-031).** Model:
one household; every device holds its own anonymous Auth session and is a member (the historical
shared account remains one); two internal profiles (אריאל `ariel` / אלנה `alena`), data separated by
`profile_id`; any member device edits both.
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
- Home stays compact: ME → PARTNER → ACTION, six compact tiles on one phone screen, **no food
  details on the tiles**; the only food name on the home is the one-line "לאחרונה" (DEC-026).
- Don't add out-of-scope analytics features. Follow the global Approval-Brief rule before any
  Supabase/auth/RLS/schema/migration/secret/env change.

## Quality gate

`tsc --noEmit`, `eslint .` (0 errors, 8 dev-only HMR warnings), `vitest run` (**186 passed**, 2 gated
live suites skipped without env), `vitest-axe` (0 violations) and `vite build` — all green as of
2026-07-25. `npm run e2e` (Playwright, 10 specs) is intentionally **not** run against the pilot
project: it signs up fresh `e2e_*` accounts, which would create extra households. Test tooling: Vitest + Testing
Library + vitest-axe + Playwright; `npm run coverage` for the report. See `project-status.md` for the
full table and `decisions.md` for the rationale of recent changes.
