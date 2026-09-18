# Run record — 2026-09-18 (tenth run) — access simplification: no login, silent device sessions (DEC-031)

**Objective:** correct a real-device product finding — the Supabase login screen introduced by M1 is a
regression for a private couple app. Replace it with a silent anonymous device session that joins the one
shared household, keep RLS/Realtime/M1-R5 intact, prove it deterministically, prepare the production
backend change and a two-minute acceptance path. Access simplification only; no feature work.
Prompt: `RUN_2026-09-18_ACCESS_SIMPLIFICATION.prompt.md`. Decision: DEC-031.

**Outcome:** `GREEN` for the repository (code, migration, tests, docs on `main`); production is
**pending a backend step the session cannot perform** (device-join migration + "Allow anonymous
sign-ins" — the setting was verified OFF), then a Lovable publish. M1 stays `YELLOW`; the previous
phone walk-through (§3a) is superseded by §3b (two minutes per phone).

## 1. Starting state

`main` @ `d693a5b`, clean, = `origin/main`. Served production build `0cd3673` (login build).

## 2. Current auth flow — why it existed, what must survive (Phase 1)

| Piece                                      | Before                                                                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthGate.tsx`                             | configured + no session → `<SignIn/>`; else children. Loading state while `getSession()` resolves.                                                                                             |
| `SignIn.tsx`                               | Email + magic link (default) or email + password, with silent sign-up fallback ("first-time shared account"). Hebrew: "כניסה לחשבון המשותף", "קישור לאימייל", "סיסמה".                         |
| `lib/supabase/auth.ts`                     | `getSession`, `onAuthChange`, `signInWithPassword`, `signUpWithPassword`, `signInWithMagicLink`, `signOut`.                                                                                    |
| `use-supabase-sync.tsx`                    | activation on a session: `bootstrap_household()` RPC → hydrate → realtime with `session.access_token` → drain; sign-out tears the channel down; ops of a different owner were **quarantined**. |
| `bootstrap_household()` (`20260723090200`) | idempotent per user: member → return household; else **create a new household** + membership + two profiles.                                                                                   |
| `household_users`                          | membership = the RLS boundary (`is_household_member(household_id)` on all 10 tables).                                                                                                          |
| Device profile (`lib/device-profile.ts`)   | "who uses this device?" once per device, localStorage, never synced — already independent of auth.                                                                                             |

The login existed because the July design was "one shared Auth account for the household": a real
session was needed so that RLS (not client filtering) protects the data and Realtime carries a JWT.
Guarantees preserved by this run: a real authenticated session per client; RLS on all 10 tables with
membership as the boundary; no `service_role` in the browser; realtime authenticated with the session
token; device-scoped person choice; legacy phone data untouched (M1-R5).

## 3. What changed (Phases 2–9)

| Area            | Change                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Silent session  | `auth.ts` → `ensureSession()`: stored session reused, else `signInAnonymously()`. `AuthGate`: `connecting` (existing neutral loading) → `ready`; on genuine failure `failed` → "לא הצלחנו להתחבר כרגע." + "נסה שוב" (no Supabase wording; `data-connection` attribute). A `SIGNED_OUT` later reconnects silently; `online` retries. `detectSessionInUrl` off (no magic links).     |
| Login UX        | `SignIn.tsx` deleted; email/password/magic-link helpers deleted. No recovery login path is retained — none is needed (data belongs to the household, any session joins).                                                                                                                                                                                                           |
| Household join  | Migration `20260918160000_anonymous_device_join.sql`: `bootstrap_household()` returns the caller's membership if any; otherwise takes an advisory xact lock, picks the **oldest** household (creates one + two profiles only if none), inserts the membership (`member`; `owner` only for the very first creator), ensures the two profiles. `revoke execute … from public, anon`. |
| Queue ownership | `queue.adoptAll(userId)`: ops stamped by a previous device identity are adopted at activation and drained (they belong to the same household by construction) instead of being quarantined as "another account".                                                                                                                                                                   |
| Device identity | Unchanged: `device-profile` chooser once per device; restored on every open; independent of the session.                                                                                                                                                                                                                                                                           |
| Session loss    | Storage cleared → new anonymous user → joins the same household → chooser → cloud data hydrates. Proven at SQL level and hook level.                                                                                                                                                                                                                                               |
| Legacy data     | Unchanged (`elenas-plate:v1` never read for data, never deleted; importer fenced). Test kept green.                                                                                                                                                                                                                                                                                |
| Realtime        | Unchanged mechanism: `subscribeHousehold(ctx, …, session.access_token)` → `realtime.setAuth(token)`; supabase-js refreshes the realtime token on auth changes. Test asserts the device JWT reaches the channel; two-device hook test asserts the partner's write arrives.                                                                                                          |
| Release scripts | `supabase/apply_anonymous_join_production.sql` (function body byte-identical to the migration + ledger row `20260918160000` + post-check), `supabase/verify_anonymous_join.sql` (households/profiles/function version/ledger/RLS/memberships), `supabase/DEPLOY.md` top section.                                                                                                   |

## 4. RLS / security review under anonymous users (Phase 4)

Anonymous Supabase users are role `authenticated` with `is_anonymous: true` in the JWT. Every policy is
`is_household_member(household_id)` / `user_id = auth.uid()` — role-agnostic — so they apply
unchanged. The `anon` (unauthenticated) role keeps **no** table privilege (grants migration) and now
explicitly no execute on `bootstrap_household()`. `is_household_member` stays executable by `anon`
(needed for policy evaluation). No policy was changed; no new table.

**Accepted consequence (stated in DEC-031):** anyone holding the URL (the publishable key is in the
bundle) can create an anonymous session and join the household. That is the product decision — the
link is the secret, as in the original localStorage app — and it is recorded with mitigation candidates
in `docs/todo.md` M1-R6 (device join code checked in the RPC, key rotation, stale anonymous-user
cleanup). Advisor items from the previous run remain M1-R6 (not touched here).

## 5. Supabase backend requirement (Phase 10) — exact

Verified from this session at 15:50: `POST https://rqgoiuztphkcvbwtbxbj.supabase.co/auth/v1/signup {}`
→ `422 {"error_code":"anonymous_provider_disabled"}` — **anonymous sign-ins are OFF on production**;
nothing was created. Required, in this order (controlling GPT / Management API — **not Ariel**):

1. SQL (Dashboard SQL editor or `POST /v1/projects/rqgoiuztphkcvbwtbxbj/database/query`): run
   `supabase/verify_anonymous_join.sql` (keep), then `supabase/apply_anonymous_join_production.sql`,
   then `verify_anonymous_join.sql` again → §3 `is_device_join_version=true`, `anon_can_execute=false`;
   §4 lists `20260918160000`; §1 shows the July household first (2 profiles, seeded catalog).
2. Auth setting: `PATCH /v1/projects/rqgoiuztphkcvbwtbxbj/config/auth` body
   `{"external_anonymous_users_enabled": true}` (Dashboard: Authentication → Sign In / Providers →
   "Allow anonymous sign-ins"). Leave CAPTCHA off; default anonymous rate limit is fine.
3. Lovable: publish `main` (sha ≥ this run's code commit) — Lovable syncs from GitHub.
4. Then `npm run preflight -- --live` must PASS with the new sha, and §3b on two phones.

Optional after M1 closes: the historical shared account's membership can stay; stale anonymous users
may be deleted periodically (memberships cascade; devices re-join silently).

## 6. Tests (Phase 11)

| Suite / check                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/supabase/household-join.pg.test.ts` (new, PGlite, node env)                       | **8/8** on the real migration SQL: first device creates household + 2 profiles (owner); second joins the SAME (member); repeat calls create nothing; third + permanent-account shape join the same; Ariel/Elena rows keep their `profile_id` across devices under RLS; a never-joined session sees nothing and cannot write; `anon` role denied; session loss re-joins and sees all rows. |
| `src/components/auth/auth.test.tsx` (rewritten)                                            | **5/5**: demo pass-through; existing session → no sign-in call, no form; no session → anonymous sign-in behind loading, no form; failure → retry state without Supabase wording, retry works; later session loss reconnects silently.                                                                                                                                                     |
| `src/lib/sync/cloud-path.test.tsx`                                                         | **16/16** (+3): device JWT reaches realtime; session loss → fresh identity sees the same data, keeps device person, writes nothing on re-join; second device writes as Elena → first device receives via realtime; previous-identity ops adopted (replaces the quarantine test); legacy snapshot test kept.                                                                               |
| `bun run test` (full)                                                                      | **315 passed / 16 skipped** (gated live suites)                                                                                                                                                                                                                                                                                                                                           |
| `bun run typecheck` / `bun run lint`                                                       | 0 errors / 0 errors, 8 pre-existing warnings                                                                                                                                                                                                                                                                                                                                              |
| `npx playwright test -c playwright.hermetic.config.ts`                                     | **8/8**                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx vite build` · `npm run preflight -- --env`                                            | OK · PASS (5)                                                                                                                                                                                                                                                                                                                                                                             |
| Browser smoke, dev server `--mode production` against real production Auth                 | Retry state rendered ("לא הצלחנו להתחבר כרגע." + "נסה שוב"), zero inputs/forms, no page errors — the expected outcome while anonymous sign-ins are OFF. `test-results/gate-failed-state.png`.                                                                                                                                                                                             |
| Gated live suites (`rls.integration`, `remote-live`, `shared-truth.live`, `e2e/*.spec.ts`) | **Ported, not executed** (need the isolated hosted branch with anonymous sign-ins ON). Semantics now: `newDevice()` = anonymous session; joins are to the one household; isolation = "never joined sees nothing"; e2e `openApp()` replaces the form; the session-loss spec expects the chooser, not a form. The e2e contexts now share one household — specs must tolerate prior data.    |

Mapping to the prompt's 13 items: 1–3 AuthGate suite; 4–6, 8–10 PGlite suite; 7 device-profile spec
(unchanged) + cloud-path session-loss test; 11 cloud-path two-device test (+ live suites); 12
cloud-path legacy test; 13 AuthGate `expectNoLoginForm` + browser smoke.

## 7. Production acceptance plan (Phase 12)

`M1_RELEASE_ACCEPTANCE.md` §3b: fresh phone → URL → **no form** → chooser → Home (`build <sha> · cloud`)
→ log one food → מסונכרן → other phone shows it under the right name → reload goes straight to Home.
Six lines, under two minutes per device. M1 closes on "§3b all OK".

## 8. Git

`main`: `d693a5b` → code commit (auth flow, migration, tests, scripts) → docs commit (this file).
Pushed to `origin/main`. Dev dependency added: `@electric-sql/pglite` (tests only); `bun add` also pruned unused nested esbuild platform entries and two orphans from `bun.lock` — no version of a real dependency changed (typecheck/build/tests green after).

---

# FINAL REPORT

## STATUS

Overall: `GREEN` for the repository; `YELLOW` for production until the backend step + republish.

- **Access:** done on `main` — no login form anywhere; silent device sessions.
- **M1:** `YELLOW` — served build still the login build `0cd3673`; closes on §3b after the republish.
- **M2-7:** waits for the republish; day 0 = §3b.
- **Repository:** all gates green; pushed.

## STARTING STATE

`main` @ `d693a5b`, clean worktree, equal to `origin/main`.

## CURRENT LOGIN PROBLEM

The served build (`0cd3673`) shows "מעקב תזונה משותף · כניסה לחשבון המשותף" with email + magic link /
password. Elena cannot start without Ariel's email or a password; every fresh device sees the form. The
form existed only to obtain a real session for RLS/Realtime, not as a product requirement.

## NEW ACCESS FLOW

Open URL → neutral loading → `ensureSession()` (stored session or silent anonymous sign-in) →
`bootstrap_household()` joins the one household → device chooser once (אריאל / אלנה) → Home.
Next opens: straight to Home as that person. Only failure state: "לא הצלחנו להתחבר כרגע." + "נסה שוב".

## ANONYMOUS AUTH

`supabase.auth.signInAnonymously()` in `lib/supabase/auth.ts::ensureSession()`; sessions persist in
localStorage and auto-refresh; a lost session is replaced silently. No public CRUD, no service role,
no hard-coded credentials, no local-only mode.

## HOUSEHOLD JOIN

Migration `20260918160000_anonymous_device_join.sql`: member → same household; else lock → oldest
household (create + 2 profiles only if none) → membership (`member`) → profiles ensured. Idempotent;
second/third sessions and the historical shared account all join the same household; no duplicate
household or profiles (PGlite proof on the real SQL, 8 tests).

## RLS / SECURITY

RLS on all 10 tables unchanged; membership remains the boundary; `anon` role: no table privileges and
now no execute on `bootstrap_household()`; no key material in the bundle beyond the publishable key.
Accepted and documented: the URL is the access secret (DEC-031 §4; mitigations listed in M1-R6).

## DEVICE PROFILE

Unchanged `device-profile` (localStorage, once per device, never synced); the session identifies the
device, the profile identifies the person. Tests: hermetic `device-profile.spec.ts` (8/8) and the
cloud-path session-loss test (person kept, data re-hydrated).

## SESSION RECOVERY

Cleared storage → new anonymous identity → same household → chooser → cloud data returns; no cloud
data is lost (SQL test "session loss", hook test, e2e `crud.spec.ts` session-loss case ported).
Pending ops from a previous identity on the same device are adopted and drained.

## REALTIME

Channel authenticated with the device session's access token (asserted); two-device hook test:
Elena's write on device B arrives on device A's partner day. Live two-phone realtime is §3b item 4.

## SUPABASE BACKEND REQUIREMENT

Exactly two things, neither done by Ariel: (1) run `supabase/apply_anonymous_join_production.sql`
against `rqgoiuztphkcvbwtbxbj` (then `verify_anonymous_join.sql`: `is_device_join_version=true`,
`anon_can_execute=false`, ledger has `20260918160000`, one household first); (2) enable anonymous
sign-ins — `PATCH /v1/projects/rqgoiuztphkcvbwtbxbj/config/auth {"external_anonymous_users_enabled": true}`
(verified OFF at 15:50: `422 anonymous_provider_disabled`). Then publish `main` from Lovable.

## TESTS

PGlite SQL 8/8 · AuthGate 5/5 · cloud-path 16/16 · vitest 315 passed / 16 skipped · typecheck 0 · lint
0/8 · hermetic Playwright 8/8 · build OK · preflight `--env` PASS · browser smoke of the failure state
against real production Auth. Gated live suites and e2e ported, not executed (no branch access here).

## GIT

`main` @ the docs commit after the code commit (see `git log`), pushed to `origin/main`; no history
rewrite; `@electric-sql/pglite` added as a dev dependency.

## DOCUMENTATION

`docs/decisions.md` (DEC-031), `docs/claude-tasks/RUN_2026-09-18_ACCESS_SIMPLIFICATION.md` (+ `.prompt.md`),
`docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md` (status, §3 note, new §3b, verdict), `docs/claude-tasks/M2_7_PILOT.md`,
`docs/project-status.md`, `docs/todo.md` (M1-R3, new M1-R7, M1-R6 addendum, M2-7), `docs/claude-context.md`,
`supabase/DEPLOY.md`, `supabase/apply_anonymous_join_production.sql`, `supabase/verify_anonymous_join.sql`.

## YOU

Nothing in Supabase, GitHub or Lovable. When the republish is announced: open the URL on your phone,
send it to Elena, each choose your name, log something — that is §3b (two minutes). Reply "§3b all OK"
or what failed.

## NEXT

Apply/verify the backend requirement (migration + anonymous sign-ins) → publish `main` → live
preflight → two-phone §3b → M1 CLOSED → M2-7 pilot. No M2-8.

## RUN TIMESTAMP

2026-09-18 16:05 local time (Israel Standard Time), on the second computer.
