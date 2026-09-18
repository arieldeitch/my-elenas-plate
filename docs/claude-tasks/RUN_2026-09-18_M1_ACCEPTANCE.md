# Run record — 2026-09-18 (ninth run) — M1 live acceptance on production

**Objective:** run `M1_RELEASE_ACCEPTANCE.md` from the latest `main` now that the owner actions A/B/C
are complete: live preflight, served-build verification, database evidence, the ten live checks as far as
an authenticated browser allows, and — if everything passes — close M1 and open M2-7. No feature work.
Prompt: `RUN_2026-09-18_M1_ACCEPTANCE.prompt.md`.

**Outcome:** **release verified, acceptance not finished.** §2 of the checklist passes in full for the
first time (`PREFLIGHT PASS`, 14 checks, on the served build of `0cd3673`, cloud/shared, correct
project, no secrets) and the production database matches the reviewed M1 design (owner-verified state
plus read-only anonymous probes from here). Of the ten §3 checks, item 9 (authorization) **PASSES** on
production; items 1–8 and 10 need the shared household account signed in on a real device, which no
Claude session has (no Chrome extension connected, Supabase/Lovable MCP belong to another workspace,
and the checklist forbids the automated sign-up flows on production). They are **NOT TESTABLE from
here**, so M1 is **not marked CLOSED** — it closes on the couple's own phones (§3a below), which is
also the first ten minutes of the M2-7 pilot.

## 1. Starting state

`main` @ `364bac5` locally, `origin/main` @ `0cd3673` (six commits by the owner: `2651c0c` key line,
then docs). Fast-forwarded; worktree clean. `.env.production` now carries the public URL, `target=shared`
and the publishable key (`sb_pub…`, 46 chars — a publishable key, not `service_role`).

## 2. Live build (`npm run preflight -- --live`)

```
PASS   live:home           https://my-elenas-plate.lovable.app/ → HTTP 200
PASS   live:deployment-id  x-deployment-id psr2.4acecc14-952f-41f4-aec6-94b6a541e8d9.1790339021.pQYI2WgswgAdhO-NblQztghHe2aS6FoOf7juczbjFq4
PASS   html:live           no misconfiguration / demo markers in the served HTML
PASS   manifest            sha=0cd3673 builtAt=2026-09-18T12:18:24.430Z mode=cloud target=shared
PASS   sha                 build sha 0cd3673 matches expected 0cd3673
PASS   mode                cloud mode (Supabase configured at build time)
PASS   target              target=shared (explicit=true)
PASS   misconfigured       manifest.misconfigured=false
PASS   supabase-host       compiled against rqgoiuztphkcvbwtbxbj.supabase.co
PASS   live:assets         2 js chunks referenced by the page
PASS   bundle-host:live    bundle contains rqgoiuztphkcvbwtbxbj.supabase.co
PASS   secrets:live        no service_role / sb_secret material
PASS   supabase-reachable  https://rqgoiuztphkcvbwtbxbj.supabase.co/rest/v1/ → HTTP 401
MANUAL db:grants+ledger    (see §3)
PREFLIGHT PASS — 14 checks (0 warnings)
```

`/build-info.json` served: `sha 0cd3673 · mode cloud · target shared · targetExplicit true ·
supabaseHost rqgoiuztphkcvbwtbxbj.supabase.co · productionBuild true · hermetic false ·
misconfigured false`. The old demo deployment `0c0eb717…` is gone.

Headless production smoke (Playwright Chromium, 412×915, unauthenticated — the only surface reachable
without the account): the sign-in screen renders (title "מעקב תזונה משותף", magic-link / password
tabs), **no RuntimeGate block page, no `role=alert`, zero console/page errors**, console prints
`[elenas-plate] build=0cd3673 … mode=cloud target=shared`. Repeated with a realistic pre-cloud
`elenas-plate:v1` snapshot in localStorage: same result, snapshot byte-for-byte intact, nothing else
written to localStorage. Screenshots: `test-results/live-fresh.png`, `live-legacy-localstorage.png`.
Observation (not a defect): Lovable's "Edit with Lovable" badge is visible bottom-left on production.

## 3. Database

Owner-verified (executed directly against `rqgoiuztphkcvbwtbxbj`, recorded in the checklist and
`claude-context.md`): 10 public tables, RLS enabled on all; `authenticated` has SELECT/INSERT/UPDATE/DELETE
and `service_role` its privileges on all 10; postgres default privileges include both roles; ledger
contains `20260725190000` and `20260916120000`; `bootstrap_household` / `is_household_member` remain
SECURITY DEFINER with `search_path=public`; anonymous probe = 0 rows on all 10.

Read-only probes from this session with the published anon key (REST, `select=*&limit=5`) against
all 10 tables — `fasting_logs food_entries food_preferences foods household_users households
meal_statuses profiles weigh_ins workout_logs`: **HTTP 200, `[]` on every one**; no key at all →
HTTP 401; anonymous `POST /rest/v1/food_entries` → `42501 new row violates row-level security policy`
(rejected, nothing written). No `db push`, no writes.

Security advisors (owner report — recorded for a dedicated hardening pass, **not** M1 blockers):
`set_updated_at` mutable search_path; SECURITY DEFINER function execution exposure; leaked-password
protection disabled. Added to `docs/todo.md`.

## 4. The ten live checks (§3)

| #   | Check                             | Result              | Basis                                                                                            |
| --- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Person selection                  | NOT TESTABLE        | needs the signed-in household account                                                            |
| 2   | Ariel-side attribution            | NOT TESTABLE        | idem                                                                                             |
| 3   | Elena-side attribution            | NOT TESTABLE        | idem                                                                                             |
| 4   | Shared visibility                 | NOT TESTABLE        | idem (two signed-in devices)                                                                     |
| 5   | Cross-side propagation            | NOT TESTABLE        | idem                                                                                             |
| 6   | Reload does not revert            | NOT TESTABLE        | signed-in state; the footer/build part is proven (`build=0cd3673 mode=cloud` on every load)      |
| 7   | Local stale state never overrides | NOT TESTABLE (live) | pre-login half proven on production (snapshot intact, nothing written); post-login needs sign-in |
| 8   | Editing hits the right person     | NOT TESTABLE        | idem                                                                                             |
| 9   | Authorization                     | **PASS**            | anonymous reads `[]` on all 10 tables, anonymous insert rejected by RLS, no key → 401            |
| 10  | Daily-use path                    | NOT TESTABLE        | idem                                                                                             |

Hermetic tests were **not** substituted for any of these.

## 4a. How M1 closes — the same checks on the couple's phones (≈10 minutes, once)

Added as §3a of `M1_RELEASE_ACCEPTANCE.md`: nine one-line actions with what to look for, done by Ariel
and Elena on their own phones right before normal use begins; the reply is "all OK" or the numbers
that were not. That reply is the evidence the next run records to mark M1 CLOSED. Alternatively, a
Claude session with the Chrome extension connected to a browser where the account is signed in can
execute §3 directly.

## 5. What was not done

No product code changed (no defect found in the served build). No feature work. No Supabase writes.
No accounts created. No MCP retries against the inaccessible projects.

## 6. Tests executed

| Check                              | Result                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `npm run preflight -- --live`      | **PREFLIGHT PASS — 14 checks** on `0cd3673`                              |
| `/build-info.json` (curl)          | cloud · shared · explicit · `rqgoiuztphkcvbwtbxbj` · misconfigured=false |
| Anonymous REST probes (10 tables)  | `[]` ×10; insert rejected (42501); no key → 401                          |
| Headless production smoke (2 runs) | sign-in renders, no gate, 0 errors, legacy snapshot intact               |
| typecheck / lint / vitest / build  | not re-run — no code changed since `364bac5` (302 passed / 15 skipped)   |

## 7. Git

`main`: `0cd3673` → docs commit (this file). Pushed to `origin/main`. Docs only.

---

# FINAL REPORT

## STATUS

Overall: `YELLOW` (release verified; acceptance pending on real devices).

- **M1:** `YELLOW` — production release verified end-to-end from here (§2 PASS, DB verified, check 9
  PASS); checks 1–8 and 10 NOT TESTABLE without the signed-in account → not marked CLOSED.
- **M2-7:** may begin now on build `0cd3673`; its first ten minutes are the acceptance walk-through.
- **Production:** deployment `psr2.4acecc14…` = `main` `0cd3673`, cloud/shared, correct project.
- **Repository:** `GREEN` — docs only; pushed.

## LIVE BUILD

Deployment id `psr2.4acecc14-952f-41f4-aec6-94b6a541e8d9.1790339021.pQYI2WgswgAdhO-NblQztghHe2aS6FoOf7juczbjFq4`;
build sha `0cd3673` = `origin/main`; built 2026-09-18T12:18:24Z; runtime target `shared` (explicit);
mode `cloud`; `misconfigured=false`; compiled against and bundling `rqgoiuztphkcvbwtbxbj.supabase.co`;
no `service_role` / `sb_secret` material; `PREFLIGHT PASS — 14 checks`. Sign-in screen served, no block
page, no console errors.

## DATABASE

Owner-verified: 10 tables, RLS on all, `authenticated`/`service_role` privileges, default privileges,
ledger `20260725190000` + `20260916120000`, SECURITY DEFINER functions pinned. From here (read-only):
anonymous reads `[]` on all 10 tables, anonymous insert rejected by RLS, unauthenticated → 401.
Advisor items recorded for a later hardening pass.

## M1 ACCEPTANCE

1 NOT TESTABLE · 2 NOT TESTABLE · 3 NOT TESTABLE · 4 NOT TESTABLE · 5 NOT TESTABLE · 6 NOT TESTABLE ·
7 NOT TESTABLE (live; pre-login half proven on production) · 8 NOT TESTABLE · **9 PASS** ·
10 NOT TESTABLE. Reason for all NOT TESTABLE: no authenticated browser session with the shared account
exists in this environment, and production sign-up flows are off-limits by the checklist.

## TWO-PERSON FLOW

Not verified on production (needs two signed-in devices). It is items 4/5/8 of §3a on the phones.

## DAILY LOOP

Not smoked on production behind sign-in. Unauthenticated surface smoked: cloud build, sign-in renders,
no errors. Item 10 of §3a on the phones.

## M1 VERDICT

**Not closed — YELLOW.** Release gate (§2) PASS; database verified; authorization PASS. The remaining
nine checks are real-device checks by definition here; they close M1 the moment Ariel and Elena run
§3a on their phones and report the result.

## PILOT

`M2_7_PILOT.md` updated: may start now on build `0cd3673` / deployment `psr2.4acecc14…`. Day 0 =
§3a walk-through (10 minutes, both phones), then three ordinary days of normal use with the one-line
friction log. No features during the pilot.

## TESTS

`npm run preflight -- --live` PASS (14) · `/build-info.json` verified · 10 anonymous REST read probes +
1 anonymous insert probe (rejected) · headless production smoke ×2 (fresh, legacy localStorage).
No code changed → typecheck/lint/vitest/build not re-run (green at `364bac5`).

## GIT

`main` @ the docs commit after `0cd3673` (see `git log`), pushed to `origin/main`; no history rewrite.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M1_ACCEPTANCE.md` (+ `.prompt.md`), `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`
(status, §2 evidence, new §3a), `docs/claude-tasks/M2_7_PILOT.md`, `docs/claude-tasks/M1_STATUS.md` §4,
`docs/project-status.md`, `docs/todo.md`, `docs/claude-context.md`.

## YOU

Nothing in Supabase, GitHub or Lovable. Only this, on your phones: open
<https://my-elenas-plate.lovable.app>, sign in with the shared account, run §3a of
`M1_RELEASE_ACCEPTANCE.md` (ten minutes, both phones), then reply "§3a all OK" or the item numbers
that were not — and start using the app normally. (Optional alternative: connect the Chrome extension
in a browser where the account is signed in, and the next run executes §3 itself.)

## NEXT

M2-7 real-device pilot. No M2-8 implementation. M1 is marked CLOSED by the next run from the §3a
result; M2-8 will be selected from the real-device friction log after the pilot.

## RUN TIMESTAMP

2026-09-18 15:27 local time (Israel Standard Time), on the second computer.
