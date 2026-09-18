# TODO

Status legend: Done / In Progress / Blocked / Deferred / Not Started.
Updated 2026-09-18. **Production bootstrap is complete** — Supabase project `rqgoiuztphkcvbwtbxbj`
holds 1 household, 2 profiles (אריאל/אלנה), 6 meal slots, RLS on 10 tables and 390 active foods
(status `READY`). Rollback code checkpoint: tag `pilot-ready-2026-07-24` (`29ac1d5`).
**M1 code is Done and merged to `main`; owner release actions A/B/C are complete; live preflight PASS on the served `0cd3673` (2026-09-18). M1 now waits only on the couple's §3a walk-through on their phones (`M1_RELEASE_ACCEPTANCE.md`).**
**T-034 was split on 2026-08-01** (DEC-023): the backend half is **Done**, the browser-dependent half
(**T-034-UI**) is **Blocked** until a browser automation capability exists.

## M1 — Shared-truth recovery (P0) — **Code Done · Release Blocked (2026-09-18)**

Spec `docs/claude-tasks/M1_SHARED_TRUTH_RECOVERY.md`, status `M1_STATUS.md`, run record
`RUN_2026-09-18_M1_PROMOTION.md`, decision DEC-024.

- [x] All 12 acceptance criteria proven on the isolated hosted branch (2026-09-16), Docker-free gate
      re-run on a second machine (2026-09-18), branch merged into `main`.
- [x] **M1-R1 — runtime config + publish.** Production publishable config is committed to `main`;
      Lovable synced the repo and a new production publish was triggered. Live preflight is part of M1-R3.
- [x] **M1-R2 — production grants/default privileges + ledger repair.** Applied and verified directly
      against `rqgoiuztphkcvbwtbxbj`: all 10 public tables RLS-enabled; authenticated/service_role have
      required privileges; ledger contains `20260725190000` + `20260916120000`.
- [ ] **M1-R3 — live acceptance.** 2026-09-18 (`RUN_2026-09-18_M1_ACCEPTANCE.md`): §2 `PREFLIGHT PASS`
      (14 checks) on the served `0cd3673`; DB verified; §3 item 9 PASS (anonymous RLS probes). Items
      1–8 and 10 need the signed-in household account on real devices → Ariel + Elena run
      `M1_RELEASE_ACCEPTANCE.md` §3a (≈10 min) and reply; the next run records it and closes M1.
      T-034-UI closes with it.
- [ ] M1-R4 — housekeeping: reset the leaked branch DB password or delete branch `uyroeumwmjhrcbkesmgb`
      once M1 is closed.
- [ ] **M1-R6 — hardening pass (after M1, not a blocker; from the Supabase security advisors,
      2026-09-18):** `set_updated_at` has a mutable `search_path` (pin `search_path = public`);
      SECURITY DEFINER functions (`bootstrap_household`, `is_household_member`) are executable by
      broader roles than needed (revoke from `anon`/`public` where safe); leaked-password protection is
      disabled in Auth. Also observed: Lovable's "Edit with Lovable" badge is visible on production
      (project setting). One dedicated run, reviewed migration, never a plain `db push`.
- [ ] **M1-R5 (product decision, Ariel) — phone-local demo data.** Every entry logged on the live
      demo build since July lives only in each phone's localStorage. The connected build starts
      empty and hydrates from the cloud; the one-time local→cloud import is disabled by design
      (`LOCAL_IMPORT_ENABLED = false`). Decide: discard (default) or re-enable a guarded one-time
      import per device before the cloud publish.

## M2 — Couple-first home (P1) — **In Progress (2026-09-18)**

- [x] M2-1 — partner's day at a glance on the home screen (`PartnerGlance`, partner day hydrated for
      the viewed date; `e2471e6`).
- [x] M2-2 — daily couple experience (DEC-026, `1732867`): home hierarchy ME → PARTNER → ACTION
      (`TodayCard`, richer `PartnerGlance` with latest food + fasting/workout, compact tiles), one-screen
      meal editor with one-tap quick add, ownership colours/labels, quiet sync indicator,
      `FoodEntry.loggedAt`. Hermetic browser loop `e2e/hermetic/couple-home.spec.ts`.
- [x] M2-3 — compact daily context row (DEC-027, `4d50765`): weight · workout · fasting under the tiles,
      inline editors on demand; fixed banner and cards removed; home 1373px → 981px on Pixel 7.
- [x] M2-4 — Day Review (DEC-028, `cd76caa`): one tap on the today card (or the partner card) shows
      the whole day per slot for me / my partner; edit shortcut for my slots; partner read-only with an
      explicit switch. Store-only, no new reads. Hermetic loop `e2e/hermetic/day-review.spec.ts`.
- [x] M2-5 — one-tap quantity (DEC-029, `aab380e`): − / + pill on count-unit rows, floor 1, fractions
      kept, Hebrew plurals, coalesced writes; grams/subjective keep the editor. "2 eggs" 6 → 4 taps.
- [x] M2-6 — direct add from search results (DEC-030, `7da1a3d`): one choose path for chips and
      results; trusted usual quantity = 1 × count unit; weight-first foods keep the quantity screen;
      results show what a tap does; search clears after an add. Typed count-unit food: 3 → 2 taps.
- [ ] **M2-7 — real-device pilot (`M2_7_PILOT.md`; may start now on `0cd3673`; day 0 = §3a).** The measured daily loop
      is now tile → chip/result → optional + → סיום → review, each one tap; the only remaining
      non-one-tap step is typing an amount for weight-first foods, and default amounts would be guesses.
      Once the M1 owner actions land: 3 days of real use by both on their phones, with a short
      observed-friction log (what took more than one tap, what was misread, what was missed), then pick
      M2-8 from that log. Candidates to watch: repeat yesterday's meal, weight-first amounts.
- [ ] M2-6 — "repeat yesterday's meal" / frequently-used foods per slot (needs a few weeks of real
      cloud data first to be worth it).
- [ ] M2-5 — run the ported hosted-branch e2e (`npm run e2e` against `uyroeumwmjhrcbkesmgb`) on a
      machine with `.env.e2e`.

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
