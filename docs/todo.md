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

## Not Started / Blocked (need backend)

- **T-002 (Blocked)** Secrets & data protection setup — no backend yet; `.env.example`, Auth, RLS pending Supabase.
- **T-003 (Blocked)** Supabase as source of truth — replace localStorage layer behind the store API; add migrations, generated types, RLS.
- **T-020 (Blocked)** Realtime sync.
- **T-021 (Blocked)** Offline queue (idempotency, retry, dedupe).
- **T-022 (Blocked)** Minimal secure auth over shared URL.

## Deferred (P2/P3, not approved for MVP)

- Weigh-in history screen, catalog management UI, export.
- Dashboard, calories, macros, goals, scoring, recommendations, gamification — explicitly out of scope.

## Nice-to-have (non-blocking)

- Distinct avatar initials for אריאל / אלנה (both currently "א").
- Quick-add FAB currently opens "ארוחה מרכזית"; consider a slot chooser.
- Consider Playwright E2E once flows stabilise.
