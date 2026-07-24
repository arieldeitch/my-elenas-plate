# GPT Handover

Continuity handover across tools. Updated 2026-07-24 (end-of-day handover, back to Lovable).

## Product

Shared Hebrew RTL, mobile-first nutrition **logging** app for **אריאל** and **אלנה**. Purpose: fast,
calm, reliable daily logging — NOT analysis. Tone is neutral and non-judgmental; status is never
communicated by color alone.

## 1. Repository state

- **Branch:** `main` · **Remote:** `https://github.com/arieldeitch/my-elenas-plate.git`.
- **Rollback tag:** `pilot-ready-2026-07-24` → `29ac1d5` — the verified backend + E2E code checkpoint
  (production-ready). Still valid; later work is additive.
- **Divergence resolved (2026-07-24):** while this handover was in progress, Lovable pushed 12 commits to
  `origin/main` (branding: `BrandIllustration` + PNG asset, `favicon.png`, `BrandMark`/`AuthGate`/`SignIn`/
  `__root` updates, `bun.lock`). No file overlap with the docs work; integrated via a normal **merge**
  (no rewrite, no force-push). The merged tree is green: tsc 0, 109 hermetic tests, build. The Playwright
  E2E suite was not re-run after the branding merge (docs-only session) — re-run `npm run e2e` next session.
- **Working tree:** clean except the intentionally-untracked `nutrition-tracker-knowledge-pack-complete/`.
- **Secrets/artifacts:** none tracked. Only `.env.example`. `.env`, `.env.e2e`, Playwright artifacts,
  `package-lock.json`, `coverage/` are gitignored.

## 2. Completed milestones (all verified)

- **Supabase integration** — typed client (anon key only, SSR-safe), repositories, generated types,
  gated store sync behind `isSupabaseConfigured()`. Demo mode (no env) = localStorage.
- **Remote deployment COMPLETE** — project `rqgoiuztphkcvbwtbxbj`; all 5 migrations applied, incl.
  `20260723090400_food_prefs_text_id.sql` (verified: text `food_id`).
- **Auth** — one shared account; magic-link + password; `bootstrap_household()` creates the household +
  two profiles (אריאל/אלנה) idempotently. Data separated by `profile_id`.
- **RLS** — every user table; `is_household_member()` (SECURITY DEFINER); 35 policies. Verified: anon
  denied, unrelated household denied, member allowed, per-profile separation.
- **Realtime** — publication for 8 tables; `subscribeHousehold` re-hydrates; two-context verified live
  (incl. remote, after the socket-auth fix).
- **Offline queue** — dirty-tracked push with in-flight protection, requeue-on-failure, reconnect retry;
  no duplicate rows on flush.
- **Local→cloud migration** — pure transform + separate markers (`v1` meal data, `foods:v1`), verified.
- **Coffee** — structured `CoffeeMeta` (type/milk/milkType/note) on the food entry; DB CHECK for
  milk-type compatibility.
- **Favorites / recents / custom foods (T-027)** — `foods` + `food_preferences` per profile; built-in
  AND custom foods; optimistic UI, realtime, offline, migration. Verified live (remote).
- **Playwright browser E2E (T-028)** — 10 specs; `npm run e2e`.
- **Remote verification** — every capability verified in the browser against the remote in isolation;
  gated integration suites 12/12 against remote (the DB layer).

## 3. Bugs fixed during T-028 (browser E2E)

1. `MealEditor` reset its view on every parent re-render (unstable `onClose` in effect deps) — reset the
   open editor mid-flow with sync active. Split the effect + stabilised home close handlers.
2. Configured mode seeded demo data (non-UUID ids) into fresh cloud accounts and persisted it to
   localStorage. Now starts empty when configured; never writes localStorage in that mode.
3. `flush` cleared dirty before pushing (offline loss) and `hydrate` had no dirty/in-flight guard (wiped
   optimistic edits, then pushed the emptied day). Added in-flight protection + requeue.
4. Mutations during the activation window weren't recorded (marker gated on `active`) → lost.
5. Activation didn't retry when interrupted (offline during bootstrap) → added `online` re-activation.
6. `subscribeHousehold` reused a fixed channel name → "cannot add callbacks after subscribe()" on
   re-activation. Unique channel name per subscription.
7. `WeighInForm` inputs had no associated labels (a11y) and reset on background hydrate. Labels wrap
   inputs; reset keyed on open only.
8. Realtime didn't reach a second session against the remote (RLS blocked `postgres_changes` because the
   socket had no JWT). `subscribeHousehold` now calls `realtime.setAuth(token)` before subscribing.

## 4. Final architecture decisions (see decisions.md)

- DEC-017 — one shared Auth account + two internal profiles; Supabase is source of truth.
- DEC-018 — `food_preferences.food_id` is a text app-id (no FK) so built-in + custom foods can be
  favorited/recented uniformly; custom foods live in `foods` (soft-delete via `is_active`).
- Store starts EMPTY when Supabase is configured and hydrates from the cloud; localStorage is not the
  source of truth in that mode (only offline queue / cache / migration markers).

## 5. Known limitations (not product bugs)

- **Remote full-suite E2E in one run** is bound by GoTrue **sign-up rate-limiting** (~15 fresh accounts
  per run) and occasional `PGRST303 "JWT issued at future"` **clock skew**. Each capability passes in
  isolation; the full 10-spec suite runs green against the local stack (identical schema).
- **CI recommendation:** run Playwright E2E against a **dedicated** Supabase project (or the local stack)
  to avoid shared-project rate limits; monitor clock skew.
- 8 dev-only `react-refresh/only-export-components` lint **warnings** (shadcn + store dual-export) — no
  runtime/production impact; documented, not suppressed globally.
- `bun.lock` is not updated for the test/e2e devDeps added via npm — a `bun install` regenerates it.

## 6. Current MVP scope

Two profiles (אריאל/אלנה) · six meal slots · `unmarked/logged/skipped` (skipped counts as complete) ·
daily completeness from the six slots only · measured + subjective quantity (stored as entered) ·
coffee (structured) · fasting (16:8, midnight crossover) · workout · weigh-ins (fat mass, delta) ·
weight banner · calendar (full/partial/empty, shape+color) · recent + favorite + custom foods ·
Supabase sync (auth, RLS, realtime, offline, migration).

## 7. Explicitly NOT part of MVP

Calories, macros, goals, nutrition scoring, dashboard/analytics, recommendations, gamification, image or
voice input, wearables, agents, household expansion beyond the two profiles, separate Auth users per
profile.

## 8. Open backlog

- **P1 ops:** add Playwright E2E to CI against a dedicated project; add a desktop Playwright project.
- **P2:** weigh-in history screen; catalog management UI (edit/rename/restore custom foods — the
  repository `archiveFood`/`upsertFood` exist, no UI yet); export.
- **Nice-to-have:** distinct avatar initials for אריאל/אלנה (both currently "א"); quick-add FAB opens
  "ארוחה מרכזית" — consider a slot chooser; an in-app sign-out control (auth has `signOut()`, no UI).
- **P3 (not approved):** everything under "Explicitly NOT part of MVP".

## 9. Next recommended development stages

1. Wire Playwright E2E into CI against a dedicated Supabase project (closes the remote-rate-limit gap).
2. Pilot with real data (Ariel + Alena) on the remote; watch sync-state + realtime in daily use.
3. Branding pass (see §10–11) — stronger illustration presence + visual refinement.
4. Only then consider P2 backlog (weigh-in history, catalog management, export).

## 10. Branding done (in Lovable)

- Wordmark **"בריאותי"** (`BrandMark`).
- Calm healthcare pastel design system: green primary (`#17A668`), info blue, per-slot soft tints, soft
  shadows, rounded cards; coherent typography scale (≥12px content floor). Per-meal-slot lucide icons +
  status badges/pills; RTL, mobile-first layout.
- **Brand illustration (added 2026-07-24, merged):** `src/components/brand/BrandIllustration.tsx` — a
  shared PNG asset with `header` / `auth` / `empty-state` / `loading` variants; used in the header
  (`BrandMark`), the auth loading state (`AuthGate`) and the sign-in screen. `favicon.png` replaced the
  old `.ico`. Merged cleanly; tsc + 109 tests + build green.

## 11. Branding still desired (optional refinement)

- Apply the illustration's `empty-state` variant to the six meal-slot tiles / empty states for a warmer,
  more illustrated home screen.
- General visual polish and optional light motion (respecting `prefers-reduced-motion`). Keep the calm,
  non-judgmental, uncluttered tone.
- Note: the `empty-state` illustration variant exists but is not yet wired into the meal tiles.

## 12. Expected repository state before the next session

- `main` at the latest pushed commit; `origin/main` and GitHub in sync; tag `pilot-ready-2026-07-24`
  present at `29ac1d5`; clean working tree; no secrets tracked. Restore `.env` (and `.env.e2e` for local
  E2E) locally from `.env.example` / `supabase/DEPLOY.md` — they are gitignored by design.

## 13. First recommended task for the next session

Add Playwright E2E to CI pointed at a dedicated Supabase project (not the shared pilot project), so the
full 10-spec suite runs green in one pass without the sign-up rate-limit / clock-skew flakiness.
