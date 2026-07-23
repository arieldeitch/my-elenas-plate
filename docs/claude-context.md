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

**No Supabase yet.** No env files, no secrets. Do not fake server persistence. The docs under
`03-architecture.md` describe the intended Supabase model; treat it as the target, not the current
state. When adding Supabase, keep the pure domain modules and the store API surface.

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
