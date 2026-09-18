# Run record — 2026-09-18 (eleventh run) — reliability / hardening window before the pilot

**Objective:** make the no-login couple app boringly reliable for the three-day pilot: baseline gate,
auth-flow audit, auth-storm safety, household-join deep verification, multi-device simulation, realtime
lifecycle, offline/recovery, legacy data, mobile/RTL/a11y QA, network budget, narrow security hardening,
link-as-secret threat review, daily-loop regression, release readiness. No features, no M2-8.
Prompt: `RUN_2026-09-18_RELIABILITY_HARDENING.prompt.md`.

**Outcome:** repository `GREEN` with four fixed defects (one P0-class race, one perf duplicate, one
mobile overflow, one systemic contrast failure) and ~50 new deterministic tests; backend DEC-031 migration
verified applied by the controlling GPT; production serves the no-login build `fd32a38` (behind `main` by
this run's commits, republish needed); **anonymous sign-ins still OFF** on production for the whole run
(probed at 16:40, 17:35, 17:39 → `422 anonymous_provider_disabled`), so no fresh-device production smoke
beyond the retry state was possible. M1 stays `YELLOW`; M2-7 starts right after the switch + §3b.

## A. Baseline (start of run, `fd32a38`)

`bun install --frozen-lockfile` no changes · typecheck 0 · lint 0/8 warnings · vitest **315 passed / 16
skipped** · hermetic Playwright **8/8** · `vite build` OK · `preflight --env` PASS (5) · PGlite 8/8 ·
`preflight --live` PASS (14) on `fd32a38` · fresh production browser: exactly **one** `POST
/auth/v1/signup`, retry state, no form.

## B/C. Auth flow audit — findings and fixes (`b87eefc`)

| Risk examined                                             | Finding                                                                                                                                                                                          | Fix / evidence                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `getSession()` + `onAuthStateChange` both connecting      | `INITIAL_SESSION(null)` arrives while the first attempt is in flight → single-flight ignores it                                                                                                  | test "StrictMode double mount = 1 sign-in"; live smoke showed 1 signup                                                       |
| Two simultaneous `signInAnonymously()`                    | only `AuthGate.connect()` calls it; single-flight + throttle                                                                                                                                     | storm tests                                                                                                                  |
| Retry taps                                                | single-flight; manual tap never throttled                                                                                                                                                        | test: 3 taps in flight → 1 request                                                                                           |
| Online/offline flapping, auth-null bursts                 | **Fixed:** automatic attempts are throttled 5 s after a failure (never after success)                                                                                                            | test: 8 events during/after a failure → 1 request                                                                            |
| Session lost while the app is open                        | **Fixed (UX):** the app used to unmount into the loading screen; now it stays mounted and reconnects in the background while the sync indicator reports the gap                                  | test: app content stays during reconnect                                                                                     |
| setState after unmount                                    | `alive` ref                                                                                                                                                                                      | —                                                                                                                            |
| AuthGate and the sync hook bootstrapping independently    | only the hook calls `bootstrap_household()`; AuthGate never does                                                                                                                                 | code read                                                                                                                    |
| Realtime before token                                     | `setAuth(token)` precedes `channel.subscribe`; supabase-js re-installs the token on `TOKEN_REFRESHED`/`SIGNED_IN` (`_handleTokenChanged`)                                                        | fake event order test                                                                                                        |
| **Stale activation after session replacement (P0-class)** | a `SIGNED_OUT` arriving while `bootstrap`/hydrate awaited the network let the old activation install a context and a realtime channel **with the old JWT**; the new session then never activated | **Fixed:** session generation guard + "activate again" flag. Regression test fails without the fix (`old-jwt` vs `new-jwt`). |
| Rapid reload creating several identities                  | possible only if the reload lands between the signup response and session persistence (ms); each identity is one harmless membership row                                                         | accepted; noted in M1-R6                                                                                                     |
| Tab background/resume                                     | supabase-js refreshes the token on visibility; no signup                                                                                                                                         | library behaviour                                                                                                            |

## D. Household join — PGlite on the real migration SQL (13 tests; `b87eefc`)

Fresh DB: first identity creates 1 household + 2 profiles (`owner`); second/third join it (`member`);
repeats create nothing; the permanent-account shape joins the same; Ariel/Elena rows keep `profile_id`
across devices under RLS; a never-joined session sees nothing and cannot write; `anon` role denied
(no table privilege at all); session loss re-joins and sees every row. Production-shaped history: an
older household (permanent owner, two profiles, catalog) plus a stray newer one → **20 first-time
identities all join the older one**, 21 memberships, still 2 profiles with stable slugs, catalog visible
to a late joiner, the stray household invisible to members, no-JWT caller rejected ("not authenticated").
Concurrency note: PGlite is one session, so the 20 joins run back-to-back — exactly the order
`pg_advisory_xact_lock` imposes on real concurrent first joins; the lock itself was verified present on
production by the controlling GPT.

## E/F/G. Multi-device, realtime lifecycle, offline (`ffd0a27`, `multi-device.test.tsx`, 11 tests)

Harness: Device A = mounted store with its own identity; Device B = second identity through the same
data layer (`bootstrapHousehold` + `applyOperation` + `hydrateDay` — jsdom has one localStorage, so two
stores cannot share a queue); Device C = third identity mounted later; the fake echoes every mutation to
all live channels. Proven: A adds → B sees it on Ariel's day; B adds as Elena → A's partner day updates
live; C joins later with Elena chosen → same cloud state, 1 household, 2 profiles; A switches to Elena
explicitly and edits → only Elena's row changes, B's reload shows it, A's device profile stays "me"; rows
carry `profile_id`, never a user id. Realtime: token set before subscribe; exactly one channel across
profile switch, date navigation and token refresh; unmount tears down; session replacement → 0 then 1
channel with the new token; duplicate INSERT/UPDATE events and the own echo never duplicate; +++ → one
write, final value 4 everywhere. Offline scenarios 1–5 pass (see FINAL REPORT).

## K. Network budget — two duplicate-read defects fixed (`ffd0a27`)

Before: activation read the current day **twice** (the activation hydrate, then the view effect once
`active` flipped) = 18 reads; after a quick add the post-drain converge and three realtime echoes
re-read the same day four times (13 reads). After: activation **12 reads, 0 writes, 1 channel**; partner
switch ≤ 10 reads; quick add **3 writes** and ≤ 8 reads (day re-reads coalesced per profile/date, 150 ms);
+++ → **1 write**; opening MealEditor / Day Review / partner glance: **0 reads** (components read the
store only — `grep` shows no data access in `components/nutrition`).

## I/J. Mobile / RTL / accessibility (`b7b1273`, `scripts/mobile-qa.mjs`, 19 states × 2 viewports)

| Finding                                                                                                | Fix                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **360 px: page overflowed 7 px** (switcher 2 × 112 px + brand block)                                   | tabs 96 px below `sm`, brand column `shrink-0` → `overflowX=false` on all 38 audited states                                                           |
| **Contrast (axe serious):** white on primary 3.1:1, muted text 3.6–4.0:1, info 3.9:1, pill 2.9:1       | tokens: primary `#117d52` (5.1:1), muted-fg `#5f6f86` (≥ 4.5:1), info `#1f6fbd` (5.2:1); literal colours routed through tokens → **axe 0 violations** |
| Touch targets < 40 px: workout כן/לא (34×32), search clear (32), review edit (36), device-default (17) | all ≥ 40 px (device-default line 36 px, secondary)                                                                                                    |
| Toasts piled up to four after quick adds, 20 px close buttons                                          | `visibleToasts={2}`, no close button (auto-dismiss; undo toast unchanged)                                                                             |
| No `<main>`, no `<h1>`                                                                                 | `<main>` + sr-only `<h1>`                                                                                                                             |
| סיום/שמירה "below fold" at 360                                                                         | measurement artefact of the 200 ms slide-in; with a settled dialog every primary action is in view                                                    |

Verified OK: RTL placement, Hebrew + numeric order ("3 יחידות", "150 גרם", LTR times), focus after a
direct add stays in the search box, focus after +/- stays on the button, long names truncate with an
ellipsis, three foods in one slot, past date, partner review/switch, dialog Escape/close. Fasting editor at
Pixel 7 is inline in the page (scrolls) — acceptable.

## L. Security hardening (`77279f3`)

| Advisor item                                                       | Classification | Action                                                                                                                                                                              |
| ------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_updated_at` mutable `search_path`                             | POST-PILOT     | migration `20260918180000` pins `search_path = ''` + `pg_catalog.now()`; PGlite proves `updated_at` still bumps; apply script `apply_hardening_post_pilot.sql`                      |
| SECURITY DEFINER exposure — `bootstrap_household`                  | FIXED          | execute revoked from public/anon in `20260918160000` (applied to production by the GPT, verified)                                                                                   |
| SECURITY DEFINER exposure — `is_household_member`                  | POST-PILOT     | keep SECURITY DEFINER (RLS recursion); `anon` never evaluates a policy (no table privilege) → execute revoked from public/anon in `20260918180000`; authenticated/service_role keep |
| Leaked-password protection disabled                                | NOT APPLICABLE | no passwords in the product since DEC-031; may be enabled anyway post-pilot (no user impact)                                                                                        |
| Performance / index notices (`household_id` FKs)                   | POST-PILOT     | unchanged; M1-R6                                                                                                                                                                    |
| Stale `deploy_all.sql` (6 of 9 migrations, old per-user bootstrap) | FIXED          | regenerated by `scripts/build-deploy-all.mjs`, "fresh project only" header, applies cleanly in PGlite                                                                               |

## M. Link-as-access-secret threat review (proportionate)

- **Discoverability:** `my-elenas-plate.lovable.app` is a guessable-looking subdomain but not listed
  anywhere public; Lovable does not index projects. Risk = someone who has the link or guesses it.
- **Impact of a stranger joining:** they become a household member and can read and write the couple's
  meal/weight/workout logs (low sensitivity per Ariel), including editing or deleting entries. They cannot
  reach other tables, other roles, keys, or the Auth admin API; RLS still bounds them to this household.
- **Anonymous-account accumulation:** one auth user + one membership row per fresh device/session;
  harmless growth; cleanup is a periodic `delete from auth.users where is_anonymous and created_at < …`
  (memberships cascade; devices re-join silently).
- **Abuse / rate limits:** Supabase limits anonymous sign-ins per IP (default 30/h); the client never
  retries automatically after a failure within 5 s and never loops; a hostile script could still create
  rows in the household — same class as "a stranger joining".
- **Smallest future mitigations (not built):** (1) an unguessable join token in the URL fragment checked
  by `bootstrap_household(token)` and stored once per device; (2) a "reset household access" SQL that
  removes all memberships except the two current phones; (3) periodic anonymous-user cleanup. Recorded in
  `docs/todo.md` M1-R6. **Verdict:** the pilot is reasonable as-is for this low-sensitivity couple app.

## N/O. Daily loop regression and release readiness

The QA walk drove the whole loop on the hermetic build at both viewports (tile → typed result → + →
weight-first fallback → custom long name → סיום → recent chip → skip → fasting → workout → weigh-in →
full day → Day Review → partner review → switch → yesterday) with the current auth/realtime code; hermetic
Playwright 8/8. Release: `.env.production` = URL + `target=shared` + publishable key; manifest plugin
emits `/build-info.json`; `preflight --env` PASS; RuntimeGate blocks a keyless production build; the
client bundle contains **no** login UX strings (`כניסה לחשבון המשותף`, `קישור לאימייל`, `שליחת קישור
כניסה` = 0 hits; the remaining `signInWithPassword`/`sb_secret_` hits are supabase-js SDK code, not app
UX or key material); no `service_role`; host `rqgoiuztphkcvbwtbxbj`.

## Production / anonymous auth during the run

`preflight --live` PASS on `fd32a38` (the published no-login build); fresh headless browser: one signup
request → `422 anonymous_provider_disabled` → retry state, no form, no errors. The switch stayed OFF at
16:40, 17:35 and 17:39 (probe: `POST /auth/v1/signup {}` with the publishable key; nothing is created
while it is off). The fresh-device production smoke (chooser, historical household, catalog, reload
reuses session) therefore could not be executed; it is the first thing to do once the switch is ON.

## Git

`fd32a38` → `b87eefc` (auth races/storm) → `ffd0a27` (perf + multi-device/realtime/offline suites) →
`b7b1273` (mobile/a11y) → `77279f3` (hardening migration, deploy_all) → docs commit (this file).
All pushed to `origin/main`; no force-push; worktree clean at the end.

---

# FINAL REPORT

## STATUS

- **repository:** `GREEN` — 336 vitest / 16 skipped, hermetic 8/8, typecheck 0, lint 0/8 warnings,
  build OK, preflight `--env` PASS, `--live` PASS; four defects fixed, ~50 tests added.
- **backend:** `GREEN` for DEC-031 — migration `20260918160000` applied and verified by the controlling
  GPT (1 household, 2 profiles, 390 foods, device-join function, ledger, RLS on 10). Post-pilot hardening
  migration `20260918180000` is on `main` only (not applied, not needed for the pilot).
- **production:** `YELLOW` — serves the no-login build `fd32a38` (`PREFLIGHT PASS`), behind `main` by this
  run's five commits; every fresh device currently sees the retry state because of the Auth switch.
- **anonymous auth:** **OFF** (`422 anonymous_provider_disabled` at 17:39) — the one remaining
  control-plane switch.
- **M1:** `YELLOW` — closes on the two-phone §3b after the switch (+ republish for the fixes).
- **M2-7:** ready to start the same day the switch is ON.

## STARTING STATE

`main` @ `fd32a38`, clean, = `origin/main`. Baseline as in §A (all green; numbers recorded).

## WORK COMPLETED

1. Baseline gate with exact numbers; live preflight and a fresh-browser production smoke (retry state).
2. Auth-flow audit: fixed a stale-activation race (old JWT on the channel after session replacement),
   background reconnect without unmounting, throttled automatic retries; 4 storm tests + 1 race test.
3. PGlite household-join suite extended to 14 tests (history wins, 20 joins, no-JWT, catalog, visibility,
   hardening migration).
4. Fake Supabase upgraded (per-channel handlers, lifecycle events, realtime auto-echo); new
   `multi-device.test.tsx` (11 tests: A/B/C devices, realtime lifecycle, offline scenarios 1–5, budget).
5. Two duplicate-read defects fixed (activation 18 → 12 reads; quick add 13 → ≤ 8).
6. Mobile/RTL/a11y QA script (`scripts/mobile-qa.mjs`) and fixes: 360 px overflow, AA palette, touch
   targets, landmarks, toasts; axe 0 violations on 38 states.
7. Security: post-pilot hardening migration + apply script; `deploy_all.sql` regenerated (was stale and
   dangerous); threat review written; advisor items classified.
8. Release readiness checks on the built bundle; docs and run record.

## ACCESS FLOW

Open URL → neutral loading → stored session reused, else one silent anonymous sign-in → household join →
device chooser once → Home. Later opens: straight to Home as that person. If the connection genuinely
fails: "לא הצלחנו להתחבר כרגע." + "נסה שוב" (single-flight; automatic retries ≥ 5 s apart after a failure;
`online` retries). A session lost while the app is open is replaced silently **without unmounting the
app**; the sync indicator shows the gap; queued ops from the previous identity are adopted and drained.

## AUTH / SESSION

Races: single-flight `connect()`; `INITIAL_SESSION(null)` during an attempt ignored; StrictMode double
mount = 1 sign-in; retry taps single-flighted; sign-out mid-activation aborts the stale activation
(generation guard) and the replacement session activates once (regression test fails without the fix).
Rate-limit protection: at most one signup per logical attempt; automatic attempts throttled 5 s after a
failure, never after success; manual retry always allowed. Session persistence: supabase-js localStorage +
auto refresh; realtime token re-installed by the SDK on refresh.

## HOUSEHOLD JOIN

PGlite on the real SQL: first identity → 1 household; historical household wins over a stray newer one;
devices 2, 3 … 20 join it (21 memberships, 2 profiles, stable slugs, catalog attached); idempotent
repeats; permanent account keeps `owner`; no-JWT and `anon` cannot bootstrap; non-member sees no household
row before bootstrap and only the joined one after. True concurrency is serialised by
`pg_advisory_xact_lock` (verified present on production by the GPT; not reproducible in single-session
PGlite).

## DEVICE IDENTITY

Person = `device-profile` (localStorage, once per device); auth user = device session. Tests: C joins as
Elena and sees both days; A switches to Elena explicitly, edits, and its device profile stays "me"; rows
never carry a user id; hermetic `device-profile.spec.ts` unchanged and green.

## MULTI-DEVICE

A adds → B sees on Ariel's day (data-layer read); B adds as Elena → A sees on the partner day via realtime
without reload; C joins later → same cloud state; A edits Elena's quantity after an explicit switch → only
Elena's row; B reload → persisted. Limitation: B is the data layer under its own identity, not a second
mounted store (single jsdom localStorage).

## REALTIME

`setAuth` before `subscribe`; one channel across profile switch, date navigation and token refresh;
unmount and sign-out tear down; replacement subscribes exactly once with the new token; duplicate events
and own echo never duplicate rows; rapid updates converge (one write, final value). Day re-reads triggered
by echoes/post-drain are coalesced (150 ms).

## OFFLINE / RECOVERY

1 online→offline→close/reopen→online: second entry drained once, queue empty, no duplicate. 2 offline
before boot with a stored session: app usable, entries queued, state "offline", drains on reconnect. 3
storage cleared → new identity → same household → cloud day reappears, 1 household. 4 pending queue under
old identity + lost session → adopted, drained, nothing quarantined or duplicated. 5 network dies during
+++ → one coalesced op → reconnect → amount 4 in the cloud and the store. No silent data loss observed.

## LEGACY DATA

`elenas-plate:v1` neither shown, imported nor deleted; with a fresh anonymous identity and cleared
importer markers the store hydrates from the cloud only, the snapshot stays byte-for-byte intact, no
writes derive from it (extended cloud-path test).

## DAILY LOOP

Full M2-1…M2-6 loop driven at 360×740 and 412×915 on the current code; hermetic Playwright 8/8; no
regression found.

## MOBILE / RTL

360×740: 7 px horizontal overflow fixed; primary actions in view; RTL order and numeric/Hebrew quantity
order correct; long names truncate; three foods in a slot fine. 412×915: no overflow before or after;
fasting editor inline (page scrolls). Screenshots: `test-results/mobile-qa/`.

## ACCESSIBILITY

axe (wcag2a/aa/best-practice) on 38 states: **0 violations** after the palette, landmark and target
fixes (was 1–4 per state incl. serious contrast). Manual: dialog focus lands on the panel/search, Escape
closes, accessible names on results/chips/stepper/trash/edit/star/review toggle, retry state is
`role=status`, chooser is a labelled dialog, skipped/logged states carry text not only colour.

## PERFORMANCE

Activation 12 reads (was 18) · 0 writes · 1 channel; partner switch ≤ 10 reads; quick add 3 writes, ≤ 8
reads (was 13); +++ 1 write; MealEditor / Day Review / partner glance 0 reads; bootstrap once per
session; auth events cause no extra hydration (view key skip) and no extra channel.

## SECURITY HARDENING

`set_updated_at` search_path — **POST-PILOT** (migration on `main`, tested). `bootstrap_household`
exposure — **FIXED** (applied). `is_household_member` exposure — **POST-PILOT** (execute revoked from
anon in the same migration; SECURITY DEFINER kept, intentional). Leaked-password protection — **NOT
APPLICABLE** (no passwords). Index notices — **POST-PILOT**. Stale `deploy_all.sql` — **FIXED**.

## PRODUCTION

Executed: `npm run preflight -- --live` PASS (14) on `fd32a38`; `/build-info.json` cloud/shared/host
verified; fresh headless browser → one signup request, retry state, no form, no errors; three anonymous-auth
probes. Not executed (switch OFF): fresh-device smoke through the chooser, historical-household check,
reload-reuses-session check.

## ANONYMOUS AUTH SETTING

**OFF** — verified by `POST https://rqgoiuztphkcvbwtbxbj.supabase.co/auth/v1/signup` `{}` with the
publishable key → `422 {"error_code":"anonymous_provider_disabled"}` at 16:40, 17:35, 17:39.

## TESTS

`bun run typecheck` 0 · `bun run lint` 0 errors / 8 warnings · `bun run test` **336 passed / 16 skipped
(42 files)** · `npx playwright test -c playwright.hermetic.config.ts` **8 passed** · `npx vite build` OK ·
`npm run preflight -- --env` PASS (5) · `npm run preflight -- --live` PASS (14) · `node
scripts/mobile-qa.mjs` 38 states, axe 0. New/extended: `auth.test.tsx` 8, `household-join.pg.test.ts` 14,
`multi-device.test.tsx` 11, `cloud-path.test.tsx` 17. Gated live suites still ported-not-run.

## GIT

`fd32a38` → `b87eefc` → `ffd0a27` → `b7b1273` → `77279f3` → docs commit (see `git log`); `origin/main`
= HEAD; worktree clean.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_RELIABILITY_HARDENING.md` (+ `.prompt.md`), `docs/project-status.md`,
`docs/todo.md` (M1-R6 classification + threat review, M1-R7 state), `docs/claude-context.md`,
`docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md` (status), `supabase/DEPLOY.md` (migration applied; post-pilot
hardening), `scripts/mobile-qa.mjs`, `scripts/build-deploy-all.mjs`, `supabase/deploy_all.sql`.

## YOU

Nothing. (When the switch is ON and the republish is announced: §3b on both phones, two minutes each.)

## NEXT

Enable the one Supabase anonymous-auth provider switch → publish if needed → §3b.

## RUN TIMESTAMP

2026-09-18 17:45 local time (Israel Standard Time), on the second computer.
