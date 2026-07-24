# Claude Context

Fast-start context for Claude Code. The latest user instruction always overrides older docs.
Updated 2026-07-23.

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
- Pure logic (tested): `completion.ts`, `coffee.ts`, `fasting.ts`, `weight.ts`, `quantity.ts`.
- App state: `src/lib/store.tsx` (React context, repository-like API). **Interim** persistence via
  `src/lib/persistence.ts` (localStorage, SSR-safe). Replace with Supabase later behind the same API.
- Demo seed: `src/lib/demo-data.ts`. Food catalog: `src/lib/food-catalog.ts`.
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

`tsc --noEmit`, `eslint .` (0 errors, 8 dev-only HMR warnings), `vitest run` (77 tests / 16 files,
coverage 66.85% stmts, 100% on pure logic), `vitest-axe` (0 violations), `vite build` — all green as
of 2026-07-23. Test tooling: Vitest + Testing Library + vitest-axe; `npm run coverage` for the
report. See `project-status.md` for the table and `decisions.md` for the rationale of recent changes.
