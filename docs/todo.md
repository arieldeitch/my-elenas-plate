# TODO

Status legend: Done / In Progress / Blocked / Deferred / Not Started.
Updated 2026-09-18. **Production bootstrap is complete** — Supabase project `rqgoiuztphkcvbwtbxbj`
holds 1 household, 2 profiles (אריאל/אלנה), 6 meal slots, RLS on 10 tables and 390 active foods
(status `READY`). Rollback code checkpoint: tag `pilot-ready-2026-07-24` (`29ac1d5`).
**M1 code is Done and merged to `main`; the M1 release is Blocked on two owner actions** (below).
**T-034 was split on 2026-08-01** (DEC-023): the backend half is **Done**, the browser-dependent half
(**T-034-UI**) is **Blocked** until a browser automation capability exists.

## M1 — Shared-truth recovery (P0) — **Code Done · Release Blocked (2026-09-18)**

Spec `docs/claude-tasks/M1_SHARED_TRUTH_RECOVERY.md`, status `M1_STATUS.md`, run record
`RUN_2026-09-18_M1_PROMOTION.md`, decision DEC-024.

- [x] All 12 acceptance criteria proven on the isolated hosted branch (2026-09-16), Docker-free gate
      re-run on a second machine (2026-09-18), branch merged into `main`.
- [ ] **M1-R1 (Ariel) — runtime config + publish (mechanical since 2026-09-18, DEC-025).** Add the
      line `VITE_SUPABASE_ANON_KEY=<anon/publishable key>` to the committed `.env.production`
      (GitHub web editor or Lovable code mode), commit to `main`, Publish from Lovable, then
      `npm run preflight -- --live` must print `PREFLIGHT PASS` (footer `build <sha> · cloud`).
      Until then the published build is **blocked** by RuntimeGate, not silently demo.
- [ ] **M1-R2 (Ariel) — apply `20260916120000_grant_table_privileges.sql` to production** via
      `supabase/DEPLOY.md` §"M1 release" (`apply_m1_grants_production.sql`, verify before/after with
      `verify_privileges.sql`). Never a plain `supabase db push` on production.
- [ ] **M1-R3 — live acceptance** (after R1 + R2, needs an authenticated browser session): the ten
      checks in the run record §"LIVE ACCEPTANCE", plus T-034-UI.
- [ ] M1-R4 — housekeeping: reset the leaked branch DB password or delete branch `uyroeumwmjhrcbkesmgb`
      once M1 is closed.
- [ ] **M1-R5 (product decision, Ariel) — phone-local demo data.** Every entry logged on the live
      demo build since July lives only in each phone's localStorage. The connected build starts
      empty and hydrates from the cloud; the one-time local→cloud import is disabled by design
      (`LOCAL_IMPORT_ENABLED = false`). Decide: discard (default) or re-enable a guarded one-time
      import per device before the cloud publish.

## T-034 (P1) — Backend verification — **Done (2026-08-01)**

Closed as **Backend Verified**. Every acceptance criterion that does not require a rendered browser has
been proven. Evidence in `project-status.md` → "T-034 partial verification".

- Production project `rqgoiuztphkcvbwtbxbj` — **RLS enforced, 11/11 anonymous probes rejected**
  (9 tables hidden, `bootstrap_household` rejected HTTP 400, anonymous INSERT rejected HTTP 401).
  Read-only; **no production row was created, updated or deleted**.
- Data layer — **12/12 gated live tests pass** against a local stack running the identical migrations:
  bootstrap creates exactly אריאל + אלנה and is idempotent, the shared account reads **and** writes
  **both** profiles, household isolation holds, CRUD on every table, coffee CHECK constraint, upsert
  idempotency, per-profile favorites/recents isolation, and realtime INSERT/UPDATE/DELETE to a second
  context.
- Persistence, profile separation by `profile_id`, and realtime — all verified.
- Offline queue — covered by `src/lib/sync/queue.test.ts`; re-queue-on-failure path reviewed. No real
  network partition was induced.
- localStorage is **not** the source of truth (code-gated on `isSupabaseConfigured()`, test-asserted).
- Quality gate green: tsc 0 errors · eslint 0 errors · vitest 186 passed · live 12/12 · build · prettier.

## T-034-UI (P2) — Live UI verification — **Blocked**

**Status:** Blocked — deliberately **not** automated inside the production application (DEC-023).

Runs only if and when a browser automation capability becomes available: Chrome DevTools MCP, Playwright
driving an already-authenticated session, or equivalent. Until then it stays open and unproven, and must
not be described as done.

Acceptance criteria (all require a rendered, authenticated browser):

- Sign in to production with the shared account.
- אריאל and אלנה both visible in the real UI.
- Switching profiles preserves the active date.
- Food search returns catalog items from the live 390-item catalog.
- A real food entry can be added **against production**.
- Refresh preserves the entry **against production**.
- No mock records appear.
- Recent Foods updates after genuine use.
- Favorite Foods remains user-controlled.
- Any failure is documented with the exact visible behaviour.

**Explicitly out of scope for this task** (DEC-023): production diagnostics tables, feature flags,
background self-tests, temporary migrations, diagnostic entities, production writes, and any
verification code that exists only to serve a deployment.

## Production bootstrap — done 2026-07-25

- **T-033 (P0) Done** — database applied to Supabase project `rqgoiuztphkcvbwtbxbj` via
  `supabase/bootstrap_and_seed.sql`, run once manually in the SQL Editor. Verified: 1 household,
  2 memberships, profiles אריאל/אלנה, 6 meal slots, RLS on 10 tables, **390 active foods**,
  `weigh_ins = 0`, status `READY`. Root cause of the first zero-row report: the seed inserts one row
  per household and the project had no household yet (`bootstrap_household()` had never run there).
  **The bootstrap must not be rerun** (DEC-021); use read-only `supabase/verify_catalog.sql` instead.
- **T-043 Done** Documentation reconciled and session closed (`project-status.md`, `todo.md`,
  `claude-context.md`, `gpt-handover.md`, `decisions.md` DEC-021, `supabase/DEPLOY.md`): the applied
  bootstrap is recorded as historical, and every "pending migration" instruction was removed.
- **T-042 (P2, open) — Playwright E2E against a dedicated project.** Deliberately not run against the
  pilot project: it signs up fresh `e2e_*` accounts, which would create extra households. Folds into
  T-029.

## Done (2026-07-25) — production catalog + mock-data removal

- **T-035 Done** Hebrew name normalization (`src/lib/food-normalize.ts`, DEC-020): geresh variants,
  niqqud, ktiv male (`עגבניה`≡`עגבנייה`), punctuation, whitespace, Latin case. 11 tests.
- **T-036 Done** 390-item Hebrew catalog spanning **14 categories**, authored in 11 modules under
  `src/data/foods/` (DEC-019). No calories, macros, health labels or scores. 25 catalog-validation +
  search tests (no blank/duplicate normalized names, valid units, default unit offered, no nutrition
  fields, no placeholder names).
- **T-037 Done** Ranked, capped search (`src/lib/food-search.ts`): index built once per list
  change, exact → prefix → word-prefix → substring, max 20 results.
- **T-038 Done** Duplicate prevention: `addFood` returns the existing food when the normalized
  name matches, so `קוטג'` resolves to `קוטג׳` instead of creating a twin.
- **T-039 Done** Mock-data bootstrap removed: `src/lib/demo-data.ts` deleted; the store starts
  empty in **every** mode; localStorage is read only in demo mode; the one-time
  localStorage→cloud import is disabled (`LOCAL_IMPORT_ENABLED = false`) so a stale demo snapshot
  cannot repopulate the cloud after cleanup.
- **T-040 Done** Cleanup + seed migration authored with fingerprint-based identification and a
  self-reporting audit; `supabase/verify_catalog.sql` added for read-only re-checks.
  **Applied to the remote on 2026-07-25** together with `supabase/bootstrap_and_seed.sql`, which
  supplies the household/profiles the seed needs (see T-033).

## Done (2026-07-22/23 — MVP hardening)

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

## Open backlog / next stages (post-pilot-ready)

- **T-031 (P2) is now more valuable** — a catalog management UI would let the household rename or
  archive seeded foods; `is_active = false` in the DB already hides a food in the app
  (`mergeCatalog`), but there is no UI for it.
- **T-029 (P1 ops, recommended first)** Add Playwright E2E to CI against a **dedicated** Supabase project
  (not the shared pilot project) so the full 10-spec suite runs green in one pass without the sign-up
  rate-limit / clock-skew flakiness. Optionally add a desktop Playwright project.
- **T-030 (P2)** Branding pass — stronger illustration presence (custom meal-slot + empty-state
  illustrations, small brand/hero illustration) + visual refinement; keep the calm, non-judgmental tone.
- **T-031 (P2)** Catalog management UI for custom foods (edit/rename/restore) — data layer exists
  (`upsertFood` / `archiveFood`), no UI yet.
- **T-032 (P2)** Weigh-in history screen; simple export.

## Nice-to-have (non-blocking)

- Distinct avatar initials for אריאל / אלנה (both currently "א").
- Quick-add FAB currently opens "ארוחה מרכזית"; consider a slot chooser.
- In-app sign-out control (auth exposes `signOut()`; no UI yet).

## Deferred / explicitly NOT in MVP (P3, not approved)

Deferred, and not to be added without an explicit decision:

- dashboard
- calories
- macros
- goals
- recommendations
- notifications
- voice input
- image recognition
- wearables
- gamification
- Agents

Also deferred: nutrition scoring, household expansion beyond the two profiles, and separate Auth users
per profile.
