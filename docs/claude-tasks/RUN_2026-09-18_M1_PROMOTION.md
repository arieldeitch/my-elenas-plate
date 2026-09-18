# Run record — 2026-09-18 — M1 production promotion attempt

**Objective:** complete the safe production promotion and live verification of M1 (review/approve the
pending grants migration → apply to production → publish through the real deployment path → verify
build identity → verify the live app), investigate the Docker auto-start, and leave a repo-accessible
record. The verbatim task prompt is in Appendix A.

**Outcome:** `YELLOW`. Code and review work is complete and merged; **both external release actions
are blocked** by account access (documented precisely below) — no false claims of success.

| Field                   | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Machine                 | Second computer (work laptop): no Node/bun, no Docker Desktop, no WSL distro, no Chrome extension at start |
| Starting branch / SHA   | `main` @ `ada47d2` (clean); verified M1 commit `edc2d54` on `origin/recovery/m1-shared-truth`              |
| Ending branch / SHA     | `main` @ **see §10 (filled after merge)**                                                                  |
| Production migrations   | **none applied** (blocked — §3)                                                                            |
| Deployment / build id   | **none performed**; live build identified as `x-deployment-id 0c0eb717…`, demo mode (§4)                   |
| Docker                  | not installed here; repo triggers removed/guarded (§6)                                                     |
| Production data touched | **none** (only anonymous HTTP GETs of the public site)                                                     |

---

## 1. Local context recovery (Phase 0/1)

- Repo `https://github.com/arieldeitch/my-elenas-plate.git`, default branch `main`, `gh` authenticated as
  `arieldeitch`. Fresh checkout (all files dated today); `~/.claude/history` shows this project was
  first opened on this computer today — the 2026-09-16 run happened on Ariel's primary workstation.
- `git fetch`: `main` = `origin/main` = `ada47d2`; `origin/recovery/m1-shared-truth` = `edc2d54`
  (9 commits ahead of `main`, merge-base `ada47d2`, nothing after `edc2d54`). Working tree clean, no
  stash, nothing to preserve.
- **M1 delta** (`git diff --stat main..edc2d54`): 45 files, +4270/−505 — sync engine (`operations.ts`,
  `queue.ts`, `drain.ts`, `supabase-sync.ts`, `use-supabase-sync.tsx`), device profile, runtime-mode
  notice + build identity (`build-info.ts`, `vite.config.ts`), tests, docs, and **one new migration**
  `supabase/migrations/20260916120000_grant_table_privileges.sql`.
- Migration history comparison:
  - repository: `…090000, 090100, 090200, 090300, 090400, 20260725190000, 20260916120000`;
  - isolated branch `uyroeumwmjhrcbkesmgb`: all seven applied (per `M1_STATUS.md §2`);
  - production `rqgoiuztphkcvbwtbxbj`: ledger records through `090400`; `20260725190000` was applied by
    SQL-editor paste (`supabase/DEPLOY.md`) and is **not in the ledger**; `20260916120000` **not
    applied**. Direct inspection of production was impossible from this session (§3), so the production
    row of this comparison is taken from the repository's own records.
- Production project identity: `rqgoiuztphkcvbwtbxbj` is named consistently in `claude-context.md`,
  `DEPLOY.md`, `deploy_all.sql`, the M1 spec and `RUNTIME_CONFIG.md`. It could **not** be positively
  verified by API this run (§3) — one more reason nothing was applied.

## 2. Grants migration — independent security review (Phase 2) — **GREEN, approved unchanged**

File: `supabase/migrations/20260916120000_grant_table_privileges.sql` (3 statements).

| Check                          | Finding                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grants / revokes               | `GRANT USAGE ON SCHEMA public`, `GRANT S/I/U/D ON ALL TABLES IN SCHEMA public`, `ALTER DEFAULT PRIVILEGES FOR ROLE postgres … GRANT S/I/U/D ON TABLES` — to `authenticated`, `service_role` only. **No REVOKE.** Idempotent.                                 |
| anon                           | Not mentioned → unchanged. RLS policies all require `is_household_member()` ⇒ `auth.uid()` ⇒ anon gets no rows regardless (verified 11/11 on 2026-08-01).                                                                                                    |
| Schema privileges              | USAGE on `public` — already the Supabase default; harmless.                                                                                                                                                                                                  |
| Sequence privileges            | **No sequences exist**: every table uses `uuid … default gen_random_uuid()`; no `serial`/`identity` in `20260723090000_schema.sql`. Nothing needed.                                                                                                          |
| Function execution             | Unchanged. `is_household_member(uuid)` → `authenticated, anon` (boolean, SECURITY DEFINER, `search_path=public`, keyed on `auth.uid()`); `bootstrap_household()` → `authenticated` only, raises when `auth.uid()` is null.                                   |
| SECURITY DEFINER / search_path | Both definer functions pin `set search_path = public` (`20260723090100_rls.sql`, `20260723090200_bootstrap.sql`). The migration does not touch functions.                                                                                                    |
| RLS interaction                | No policy created/altered/dropped; RLS remains enabled on all 10 tables. GRANT is the prerequisite for RLS evaluation, not a bypass. `service_role` bypasses RLS by design (server-only; never in the client).                                               |
| Owner / member / shared truth  | Unaffected: authorisation is still household membership via `household_users`.                                                                                                                                                                               |
| Accidental widening            | None relative to production's implicit state (`arwdDxtm` at provisioning time). Note for the future: default privileges mean a table created **without** RLS would be reachable by `authenticated` — same as before; keep the "no RLS-disabled table" check. |
| Backward compatibility         | No schema/data change → the running client is unaffected whether or not it is applied.                                                                                                                                                                       |
| Destructive?                   | No.                                                                                                                                                                                                                                                          |
| Intended vs verified state     | Identical SQL was applied to the isolated branch on 2026-09-16 and verified there (`M1_STATUS.md §2`).                                                                                                                                                       |

**Hazard found and mitigated:** because production's ledger lacks `20260725190000`, a plain
`supabase db push` would re-run the cleanup/seed migration on real data (DEC-021). Added
`supabase/apply_m1_grants_production.sql` (grants + ledger rows for both versions, idempotent) and
`supabase/verify_privileges.sql` (read-only before/after report); `supabase/DEPLOY.md` §"M1 release"
documents the path.

## 3. Production migration (Phase 3) — **BLOCKED, nothing applied**

Every legitimate path was checked and none exists from this session:

| Path                                | Result                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase MCP (`claude.ai Supabase`) | `list_projects` shows only the Noris organisation (`jauaspogygzagvdgwzwi`, 9 projects); `get_project rqgoiuztphkcvbwtbxbj` → _"You do not have permission"_. |
| Supabase CLI                        | Not installed; no Node until this run installed a portable one; no `supabase/.temp/project-ref`; no DB password (must not be requested).                     |
| Dashboard via browser               | Chrome extension not connected on this machine.                                                                                                              |
| Lovable `query_database`            | Lovable MCP account (`licenses-hq@norismedical.com`, workspace "Noris's Lovable") cannot see the Nutrition App project (`404 project_not_found`).            |

No workaround was attempted. The apply path for Ariel is in §"YOU".

## 4. Deployment / build identity (Phase 4) — **chain proven; publish BLOCKED**

Chain, each link with its evidence:

1. **GitHub** `main` @ `ada47d2` (before this run) → after this run: M1 merged (§10).
2. **Lovable project** `ca9aedab-a0ca-4889-a545-9d673febf3a0` — id recorded in the committed
   `src/assets/brand-illustration.png.asset.json`; Lovable's `gpt-engineer-app[bot]` commits land on
   `main` ⇒ `main` is the connected branch. Not accessible from the connected Lovable account.
3. **Publish** — manual, in Ariel's Lovable account. Zero GitHub deployments/environments/workflow
   runs (`gh api`), so pushing to `main` deploys nothing (re-verified).
4. **Live URL** `https://my-elenas-plate.lovable.app` (HTTP 200, `Server: cloudflare`,
   `x-deployment-id: 0c0eb717b3ba11d94402ff682bf086c610054b78a1e9c14f04b324cfcaf7e375`, assets
   `index-DDV3cWq7.js`, `routes-CwWPWhBt.js`, `styles-CJFasgdi.css`). Preview URL returns 401.
5. **Build ↔ commit:** no SHA embedded (pre-M1 build). Content fingerprint: 390-item catalog present
   (`veg_salad`, `israeli_salad`, `שקשוקה` …) ⇒ built from `main` ≥ `6768c99` (2026-07-25); no later
   `main` commit changed shipped client code ⇒ functionally `main` HEAD client code before M1.
   M1 markers (`quarantine`, `ownerUserId`, `RuntimeModeNotice` copy) absent.
6. **Production Supabase target: NONE.** The served `index-DDV3cWq7.js` compiles the client module as
   `var Lg=``,Rg=``;function zg(){return!1}` (URL "", key "", `isSupabaseConfigured()` ⇒ `false`); no
   `[a-z]{20}.supabase.co` host appears in the HTML or either chunk; the SSR HTML renders the home
   screen with no sign-in gate. **The live app is in demo mode: each phone's localStorage is the only
   store.** This is the root cause of "no transactional rows in production" (M1 spec §3.6) and it makes
   every shared-truth journey impossible on the current publish regardless of the M1 code.

Build-identity mechanism: M1's `VITE_BUILD_SHA` verified locally on this machine —
`vite build` on `edc2d54` embeds `edc2d54` in `.output/public/assets/routes-CE3WhUix.js`
(`[elenas-plate] build=… mode=…`, `window.__ELENAS_PLATE_BUILD__`). No new mechanism was needed.

## 5. Live M1 acceptance (Phase 5)

No authenticated browser session exists on this machine and no production write was made. Items
marked FAIL are failures **by construction** of the currently published artifact (evidence §4.6), not
observed user journeys.

| #   | Check                                                    | Result       | Basis                                                                             |
| --- | -------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| 1   | Identity / person selection behaves as intended          | NOT TESTABLE | needs a rendered session; live build predates the device chooser                  |
| 2   | Ariel-side data attributed correctly                     | NOT TESTABLE | no backend involved in the live build                                             |
| 3   | Elena-side data attributed correctly                     | NOT TESTABLE | idem                                                                              |
| 4   | Shared visibility behaves correctly                      | **FAIL**     | live build has no Supabase config → data never leaves the phone                   |
| 5   | Changes from one side become visible to the other        | **FAIL**     | idem — cross-device propagation impossible                                        |
| 6   | Refresh/reload does not silently revert state            | NOT TESTABLE | localStorage persists in demo mode; not observed                                  |
| 7   | Duplicate/local stale state does not override prod truth | **FAIL**     | local state **is** the only truth in the live build                               |
| 8   | Editing does not mutate the wrong person's data          | NOT TESTABLE | not observed                                                                      |
| 9   | Authorization prevents cross-user mutation               | NOT TESTABLE | no backend calls from the live build; RLS itself last verified 2026-08-01 (11/11) |
| 10  | Basic daily-use path works after migration/deployment    | NOT TESTABLE | no migration/deployment happened                                                  |

Regression coverage: the M1 branch already encodes the shared-truth regressions (unit
`shared-truth.test.ts`, live `shared-truth.live.integration.test.ts`, browser `e2e/shared-truth.spec.ts`,
hermetic `runtime-mode.spec.ts` which asserts a demo build never contacts Supabase). No new test was
added because the discovered defect is a **deployment configuration**, not code.

## 6. Docker auto-start (Phase 6)

- **This machine:** Docker Desktop not installed (`C:\Program Files\Docker` absent, no `docker` on PATH,
  no Docker service/scheduled task, no `settings-store.json`), no WSL distributions, only Windows'
  own `wslservice`. HKCU/HKLM `Run` keys contain no Docker entry. The 2026-09-16 auto-start happened on
  the primary workstation and cannot be reproduced here.
- **Repository audit:** no `package.json` script, Playwright/Vitest config or test starts Docker or
  `supabase start`; no `.devcontainer`, `.vscode`, `.claude` hooks. Claude MCP config here has no
  Docker-based server. The one repo-level trigger was the stale instruction in `docs/claude-context.md`
  ("run them against a local stack (`npx supabase start`)") — **removed**.
- **Guard added:** `.claude/settings.json` (committed) denies `docker*`, `docker-compose*`, `podman*`,
  `supabase start*`, `supabase db reset|diff|dump|lint|start*`, `supabase test *`,
  `supabase functions serve*` (incl. `npx`/`bunx`, Bash and PowerShell tools). Deny rules apply in all
  permission modes; Docker remains available for deliberate manual use.
- **Documented:** `docs/NO_LOCAL_DOCKER_POLICY.md` § "Enforcement and workstation checklist" — the CLI
  commands that require Docker, and a 5-step checklist for the primary workstation (Docker Desktop
  "start on sign-in" setting, `claude mcp list`/`~/.claude.json` for `docker run`/`docker mcp gateway`
  servers, `SessionStart` hooks, VS Code Dev Containers, WSL integration). Nothing machine-wide was
  changed by this run.

## 7. Tests executed (Phase 7)

Toolchain installed user-scoped for this run (removable by deleting the folders): portable Node
`v22.23.2` (`%LOCALAPPDATA%\node-portable`, SHA-256 verified against `SHASUMS256.txt`), portable bun
`1.4.2` (`%LOCALAPPDATA%\bun-portable`, SHA-256 verified), Playwright Chromium headless shell
(`%LOCALAPPDATA%\ms-playwright`). Repo-local `git config core.autocrlf false` (machine default `true`
produced CRLF checkouts that broke `catalog-seed.test.ts` and prettier).

Two environment pitfalls worth knowing: `npm install` resolves `@tanstack/react-router` 1.170.38
(lockfile: 1.170.16) whose `ErrorComponentProps.error` is `unknown`, failing `tsc` on the
pre-existing `errorComponent` in `src/routes/__root.tsx` — `bun install --frozen-lockfile` reproduces
the verified tree exactly.

| Command (on `edc2d54`, bun-installed)                  | Result                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                    | 0 errors                                                                                                                                                       |
| `bun run lint`                                         | 4 prettier errors in files untouched by M1 (`coffee.ts`, `domain.ts`, `database.types.ts`) → fixed with `eslint --fix` → **0 errors, 8 pre-existing warnings** |
| `bun run test` (vitest)                                | **254 passed, 15 skipped** (3 gated live suites — no branch credentials here), 34 files                                                                        |
| `bun run build`                                        | OK; `edc2d54` embedded in `routes-CE3WhUix.js`                                                                                                                 |
| `npx playwright test -c playwright.hermetic.config.ts` | **3 passed** (device profile ×2, runtime mode)                                                                                                                 |
| `npm run e2e` / live integration suites                | **not run** — require `.env.e2e` / `SUPABASE_TEST_*` for the isolated branch, absent here; they passed 15/15 + 12/12 on 2026-09-16                             |
| Final re-run after doc/config commits                  | see §10                                                                                                                                                        |

## 8. Changes made by this run

| Area          | Change                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code (format) | `src/lib/coffee.ts`, `src/lib/domain.ts`, `src/lib/supabase/database.types.ts` — prettier union-type formatting only (no semantic change)                                                                                                                                                                          |
| Config        | `.claude/settings.json` — Docker-launch deny rules                                                                                                                                                                                                                                                                 |
| Supabase      | `supabase/verify_privileges.sql` (read-only), `supabase/apply_m1_grants_production.sql` (dashboard apply + ledger), `supabase/DEPLOY.md` §"M1 release"                                                                                                                                                             |
| Docs          | `docs/claude-context.md` (state, blockers, toolchain, removed `supabase start`), `docs/RUNTIME_CONFIG.md §4` (verified failing), `docs/NO_LOCAL_DOCKER_POLICY.md` (enforcement + checklist), `docs/claude-tasks/M1_STATUS.md §4`, `docs/decisions.md` DEC-024, `docs/todo.md`, `docs/project-status.md`, this file |
| Git           | `recovery/m1-shared-truth` → commits above → merged into `main` (`--no-ff`) → pushed                                                                                                                                                                                                                               |
| Supabase prod | **nothing**                                                                                                                                                                                                                                                                                                        |
| Lovable       | **nothing**                                                                                                                                                                                                                                                                                                        |
| Local machine | portable Node/bun/Playwright in `%LOCALAPPDATA%`; repo-local `core.autocrlf=false`                                                                                                                                                                                                                                 |

## 9. Unresolved issues

1. Grants migration not applied to production (owner action; §"YOU").
2. Published build has no Supabase configuration — the app is not shared in production today (owner
   action; §"YOU").
3. Live acceptance + T-034-UI still need an authenticated browser session after 1 + 2.
4. The 2026-09-16 Docker auto-start trigger on the primary workstation is unidentified; checklist
   provided.
5. Branch DB password leaked into a transcript on 2026-09-16 (branch only) — reset/delete pending.

## 10. Git result

Filled after the merge (final commit of this run):

- M1 branch tip after run commits: _see final section_
- `main` merge commit: _see final section_
- Push state: _see final section_

---

# FINAL REPORT

## STATUS

`YELLOW` — code, review and repository state are complete and green; production migration,
publication and live verification are **blocked by account access**, documented exactly, with no
false claims of success. The live site was found to be running without any Supabase configuration.

## STARTING STATE

`main` @ `ada47d2d25dc401c9c4c8b347e39460b7770e3ba`, clean working tree, in sync with `origin/main`.
Verified M1 commit `edc2d54da72bdcd1ac73952253606d442d19178e` present on
`origin/recovery/m1-shared-truth` (9 commits ahead of `main`, nothing after it).

## CHANGES

- **Git:** 3-file prettier fix, `.claude/settings.json`, two Supabase helper SQL files, DEPLOY.md
  section, seven doc updates, this run record; `recovery/m1-shared-truth` merged into `main`
  (`--no-ff`) and both branches pushed (§10).
- **Supabase:** nothing changed in any project.
- **Lovable / deployment:** nothing published or changed.
- **Local configuration:** portable Node 22.23.2, bun 1.4.2 and Playwright Chromium under
  `%LOCALAPPDATA%` on this computer; `core.autocrlf=false` for this repo only.

## PRODUCTION DATABASE

Reviewed `20260916120000_grant_table_privileges.sql` — **approved unchanged** (§2: grant-only,
idempotent, no revoke, anon untouched, no sequences, definer functions pin `search_path`, RLS
untouched, backward compatible). **Not applied** — no path to `rqgoiuztphkcvbwtbxbj` from this
session (§3). Verification evidence therefore does not exist yet; the before/after procedure is
`supabase/verify_privileges.sql` + `supabase/apply_m1_grants_production.sql`.

## BUILD IDENTITY

Deployed build = Lovable project `ca9aedab…`, `x-deployment-id 0c0eb717…`, assets
`index-DDV3cWq7.js`/`routes-CwWPWhBt.js`; content matches `main` client code ≥ `6768c99`
(pre-M1, no embedded SHA). It is **not** an M1 build and it is **not configured for any Supabase
project** (`isSupabaseConfigured()` compiled to `false`). M1's `VITE_BUILD_SHA` mechanism verified
locally (`edc2d54` embedded).

## LIVE ACCEPTANCE

| #   | Check                                    | Result       |
| --- | ---------------------------------------- | ------------ |
| 1   | Identity / person selection              | NOT TESTABLE |
| 2   | Ariel-side attribution                   | NOT TESTABLE |
| 3   | Elena-side attribution                   | NOT TESTABLE |
| 4   | Shared visibility                        | FAIL         |
| 5   | Cross-side propagation                   | FAIL         |
| 6   | Reload does not revert                   | NOT TESTABLE |
| 7   | Stale local state does not override      | FAIL         |
| 8   | Editing does not hit the wrong person    | NOT TESTABLE |
| 9   | Authorization blocks cross-user mutation | NOT TESTABLE |
| 10  | Daily-use path after release             | NOT TESTABLE |

(FAIL = by construction of the published demo-mode build, §4.6.)

## DOCKER

Docker Desktop is not installed on this computer, so the 2026-09-16 start (primary workstation) could
not be reproduced. The repository contained one trigger — the `npx supabase start` instruction in
`claude-context.md` — now removed; `.claude/settings.json` denies every Docker-launching command from
Claude sessions; the CLI commands that need Docker and a 5-step workstation checklist are in
`docs/NO_LOCAL_DOCKER_POLICY.md`. Remaining: Ariel runs the checklist on the primary workstation
(most likely Docker Desktop "Start when you sign in", or a `docker …` MCP server in `~/.claude.json`).

## TESTS

typecheck 0 errors · eslint 0 errors / 8 warnings · vitest 254 passed / 15 skipped · `vite build` OK
with SHA · hermetic Playwright 3/3 · live/branch suites not run (no credentials on this machine).
Details §7.

## GIT

See §10 (filled in the final commit).

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M1_PROMOTION.md` (this), `docs/claude-context.md`,
`docs/RUNTIME_CONFIG.md`, `docs/NO_LOCAL_DOCKER_POLICY.md`, `docs/claude-tasks/M1_STATUS.md`,
`docs/decisions.md` (DEC-024), `docs/todo.md`, `docs/project-status.md`, `supabase/DEPLOY.md`,
`supabase/verify_privileges.sql`, `supabase/apply_m1_grants_production.sql`, `.claude/settings.json`.

## YOU

Three actions, in this order — each is a few minutes and none can be done from a Claude session:

1. **Lovable → project `my-elenas-plate` → Settings → Environment variables:** add
   `VITE_SUPABASE_URL = https://rqgoiuztphkcvbwtbxbj.supabase.co` and
   `VITE_SUPABASE_ANON_KEY = <the anon/publishable key from Supabase → Settings → API>` (public values;
   never the `service_role` key). Then **Publish/Update** from `main`. Check: open the site, sign in,
   footer reads `build <sha> · cloud` (not `· demo`, no red alert).
2. **Supabase Dashboard → `rqgoiuztphkcvbwtbxbj` → SQL Editor:** run `supabase/verify_privileges.sql`
   (read-only), then `supabase/apply_m1_grants_production.sql`, then `verify_privileges.sql` again
   (§2 must be empty, §7 must list `20260725190000` and `20260916120000`). Never a plain
   `supabase db push` against production.
3. **Primary workstation Docker checklist** (`docs/NO_LOCAL_DOCKER_POLICY.md`, last section) — start
   with Docker Desktop → Settings → General → "Start Docker Desktop when you sign in".

Optional: give a future Claude session either a Supabase MCP connection for the owning account, or a
Chrome session signed into Lovable + Supabase, so steps 1–2 and the live acceptance can be executed
and verified without you.

## NEXT

After actions 1–2: run the read-only production verification (`docs/RUNTIME_CONFIG.md §4` +
`supabase/verify_privileges.sql`) and the ten-item live M1 acceptance in an authenticated browser
(T-034-UI). M1 closes when the acceptance table is all PASS; M2 (couple-first home screen) follows.

## RUN TIMESTAMP

Filled in the final commit (§10).

---

## Appendix A — task prompt sent into this run (verbatim)

See `RUN_2026-09-18_M1_PROMOTION.prompt.md` next to this file.
