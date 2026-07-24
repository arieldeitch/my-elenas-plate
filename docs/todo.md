# TODO

Status legend: Done / In Progress / Blocked / Deferred / Not Started.
Updated 2026-07-23 with verified findings from the MVP-hardening session.

## Done (this session)

- **T-001** Repository audit (branch/commit/stack/scripts/config) — Done. See `project-status.md`.
- **T-A01** Fix lint gate — Done. Added `endOfLine: auto`; normalised formatting; removed `any` in demo-data. `eslint .` → 0 errors.
- **T-A02** Extract pure domain logic into tested modules — Done. `completion`, `coffee`, `fasting`, `weight`, `quantity`.
- **T-A03** Coffee logging (MVP) — Done. Structured `CoffeeMeta` (type, milk, milkType, note) on `FoodEntry`; `CoffeeSelector`; fast-add button in search; validation + milk-type clearing; edit/delete/undo; recents/favorites/search; profile+date separation; persisted.
- **T-A04** Typography floor — Done. Content text no smaller than 12px; secondary body 13px; captions unified.
- **T-A05** Add test framework + tests — Done. Vitest + Testing Library; 54 tests (domain, coffee, store integration, CoffeeSelector).
- **T-A06** Interim persistence — Done. localStorage hydrate/save (SSR-safe); refresh/date/profile keep data.
- **T-A07** Bug fix — `removeEntry` returned `undefined` (undo toast broken) — Done. Now reads entry from current state before mutating; covered by test.

### Second QA pass (2026-07-23)

- **T-A08** Coverage tooling + report — Done. `@vitest/coverage-v8`, `npm run coverage`. 77 tests / 16 files; 66.85% statements, 100% on pure logic.
- **T-A09** Component/integration tests — Done. MealCard, MealEditor (add coffee, add+delete searched food, skip+undo), ProfileSwitcher, WeightBanner, DateNavigator, FastingCard, WorkoutCard.
- **T-A10** Automated accessibility — Done. `vitest-axe` on 5 key components, 0 violations.
- **T-A11** A11y/UX polish — Done. `prefers-reduced-motion` reset; 44px icon-only touch targets; MealEditor focus-on-open.
- **T-A12** Warnings triage — Done (documented). 8 `react-refresh` dev-only HMR hints; see `project-status.md`. No global suppression.
- **T-A13** Package-manager state — Verified. Repo uses bun (`bun.lock`); no `packageManager` field. Installs verified via npm; npm `package-lock.json` is gitignored. `bun.lock` will refresh on the next `bun install` (test devDeps).

## Supabase backend (2026-07-23)

- **T-002 Done** Secrets/data protection — `.env.example`, anon-key-only client, no service_role, RLS on all tables.
- **T-003 Done** Supabase source of truth — schema + generated types + repositories behind the store API,
  gated by `isSupabaseConfigured()`; localStorage demoted to demo/queue/cache.
- **T-020 Done (needs live browser verify)** Realtime — publication + `subscribeHousehold` re-hydrate.
- **T-021 Done** Offline queue — `src/lib/sync/queue.ts` (dedupe, retry, quarantine), unit-tested.
- **T-022 Done** Auth — shared-account magic-link + password (`SignIn`, `AuthGate`, `bootstrap_household`).
- **T-023 Done** Local→cloud migration — pure transform + marker, non-destructive, unit-tested.
- **T-024 Done** RLS/bootstrap live-verified via local Supabase (5/5 integration tests).

### Remote (2026-07-23)

- **T-025 Done** Remote schema applied (`supabase db push`). Verified via REST: 10 tables, RLS active
  (anon read `[]`, anon write `42501`), `bootstrap_household` present; structure == locally-verified.
- **T-026 Done (live, remote)** With "Confirm email" disabled, two gated suites verified against the
  remote (10/10): auth/session, bootstrap (1 household + אריאל/אלנה, idempotent), RLS isolation, CRUD on
  all tables, coffee round-trip + CHECK, idempotency (no duplication), local→cloud migration, and
  two-context realtime (insert/update/delete). See `project-status.md`.

### Follow-ups

- **T-027 Done + remote-verified (2026-07-24)** Sync custom foods + favorites + recents. Migration
  `090400` (food_id→text) **applied to the remote** and verified; built-in AND custom food
  favorites/recents sync live in the browser with per-profile separation.
- **T-028 Done + remote-verified (2026-07-24)** Playwright browser E2E: 10 specs (auth/bootstrap/RTL/mobile,
  meal+coffee CRUD, custom + built-in foods/favorites/recents, fasting/workout/weigh-in, profile
  separation, session lifecycle, two-context realtime, offline+reconnect). `npm run e2e`; `.env.e2e` →
  local stack, else remote. Found and fixed 8 real production-readiness bugs (editor reset, seed
  pollution, optimistic-wipe / offline loss, activation-window/reconnect, realtime channel collision,
  weigh-in a11y labels, realtime auth token). Full suite green vs local; each capability verified vs
  remote (single full-suite remote run is rate-limit/clock-skew bound — see `project-status.md`).

## Deferred (P2/P3, not approved for MVP)

- Weigh-in history screen, catalog management UI, export.
- Dashboard, calories, macros, goals, scoring, recommendations, gamification — explicitly out of scope.

## Nice-to-have (non-blocking)

- Distinct avatar initials for אריאל / אלנה (both currently "א").
- Quick-add FAB currently opens "ארוחה מרכזית"; consider a slot chooser.
- Consider Playwright E2E once flows stabilise.
