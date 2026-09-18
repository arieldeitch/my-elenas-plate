# Run record — 2026-09-18 (eighth run) — M1 closure attempt + M2-7 pilot preparation

**Objective:** close M1 in production (verify the owner actions with evidence, run the live preflight,
verify the database, perform the ten live acceptance checks, smoke the daily loop on production) and
prepare the three-day real-device pilot. No feature work. Prompt:
`RUN_2026-09-18_M1_CLOSE_ATTEMPT.prompt.md`.

**Outcome:** `YELLOW`. **M1 could not be closed — the owner actions have not happened**, verified with
evidence (§2), and this session still has no path to production (§3). Everything that did not depend
on the owner was done: legacy-phone-data safety proven by a deterministic test, the release checklist
now carries the evidence and direct links, and the pilot protocol is ready to start.

## 1. Starting state

`main` @ `2f90d75`, clean, = `origin/main`; no commit landed on `main` since Claude's last one.

## 2. Owner actions — verified state (evidence, not assumption)

| Owner action                                 | Evidence                                                                                                                                                                                   | State            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| A — key line in `.env.production`, committed | `origin/main` = `2f90d75` (Claude's docs commit); `.env.production` contains only `VITE_SUPABASE_URL` and `VITE_RUNTIME_TARGET=shared`                                                     | **not done**     |
| B — Lovable Publish/Update                   | `npm run preflight -- --live` → `x-deployment-id 0c0eb717…` (unchanged since the first run), title "גרסת הדגמה", `/build-info.json` missing → **PREFLIGHT FAIL** (`html:live`, `manifest`) | **not done**     |
| C — grants SQL in the Supabase Dashboard     | No pasted output; Supabase MCP → "You do not have permission" for `rqgoiuztphkcvbwtbxbj`; no browser session                                                                               | **unverifiable** |

## 3. Access in this session (checked once, not retried)

Supabase MCP: no permission on the production project. Chrome extension: not connected. Therefore
Phases 3–5 and 7 of the prompt (DB verification, live acceptance, two-context flow, production
smoke) are `NOT TESTABLE` in this run, and no workaround was attempted.

## 4. What was done instead

| Item                         | Result                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy phone data (Phase 6)  | New test `cloud-path.test.tsx` "legacy phone data (M1-R5 safety)": with a realistic `elenas-plate:v1` snapshot present, the cloud build shows only Supabase data, pushes nothing derived from the snapshot, leaves it byte-for-byte intact, sets the importer markers, and new logging goes to the cloud. 13/13 in the suite. |
| Release checklist (Phase 12) | `M1_RELEASE_ACCEPTANCE.md`: status block with the evidence above; **direct links** for A (GitHub edit page of `.env.production` on `main`), B (Lovable project), C (Supabase SQL editor); §5 legacy-data proof.                                                                                                               |
| Pilot protocol (Phases 8–10) | `M2_7_PILOT.md`: three ordinary days, one-line friction log (date · who · action · what felt wrong · severity · note), what the app already shows (sync states, build footer), known non-blocking limitations, fields to fill at start.                                                                                       |
| Observability (Phase 10)     | Verified existing: sync states מסונכרן / מסנכרן… / ממתין לסנכרון / לא מקוון / הסנכרון נכשל (+ retry); footer `build <sha> · cloud`; `/build-info.json`; RuntimeGate block page. Sufficient; nothing added.                                                                                                                    |
| In-app feedback (Phase 9)    | None exists and none was added — the manual log is the mechanism.                                                                                                                                                                                                                                                             |
| Feature work (Phase 11)      | None. Candidates noticed earlier stay recorded in `docs/todo.md` (M2-6 deferred items) only.                                                                                                                                                                                                                                  |

## 5. Tests executed

| Check                                             | Result                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run preflight -- --live`                     | **FAIL** — `html:live` (demo title), `manifest` missing; deployment `0c0eb717…` |
| `npx vitest run src/lib/sync/cloud-path.test.tsx` | 13 passed (incl. the new legacy-data test)                                      |
| `bun run typecheck` / `bun run lint`              | 0 errors / 0 errors, 8 pre-existing warnings                                    |
| `bun run test`                                    | 302 passed, 15 skipped                                                          |
| `vite build`                                      | OK                                                                              |
| Live acceptance / production smoke                | not executed — no access                                                        |

## 6. Git

`main`: `2f90d75` → docs/test commit (this file). Pushed to `origin/main`. No code behaviour changed.

---

# FINAL REPORT

## STATUS

Overall: `YELLOW`.

- **M1:** `YELLOW` — not closed; owner actions A and B verifiably not done, C unverifiable.
- **M2-7:** protocol ready (`M2_7_PILOT.md`), **not started** (starts when M1 closes).
- **Production:** unchanged pre-M1 demo deployment `0c0eb717…`; production DB state unknown from here.
- **Repository:** `GREEN` — gates pass; pushed.

## STARTING STATE

`main` @ `2f90d75`, clean worktree, equal to `origin/main`.

## LIVE BUILD

Deployment id `0c0eb717b3ba11d94402ff682bf086c610054b78a1e9c14f04b324cfcaf7e375` — the same pre-M1
demo bundle as on the first run: no `/build-info.json`, title "גרסת הדגמה", no Supabase host in the
bundle. Runtime target: none (pre-target build); cloud/demo state: **demo**. Preflight FAIL.

## PRODUCTION DATABASE

Not verifiable in this session (no access, no pasted `verify_privileges.sql` output). Nothing was run.

## M1 ACCEPTANCE

| #   | Check                            | Result                                       |
| --- | -------------------------------- | -------------------------------------------- |
| 1   | Identity / person selection      | NOT TESTABLE                                 |
| 2   | Ariel attribution                | NOT TESTABLE                                 |
| 3   | Elena attribution                | NOT TESTABLE                                 |
| 4   | Shared visibility                | NOT TESTABLE                                 |
| 5   | Cross-person propagation         | NOT TESTABLE                                 |
| 6   | Refresh persistence              | NOT TESTABLE                                 |
| 7   | Cloud truth vs stale local state | NOT TESTABLE live (hermetic proof added, §4) |
| 8   | Correct edit ownership           | NOT TESTABLE                                 |
| 9   | Authorization boundary           | NOT TESTABLE                                 |
| 10  | Normal daily-use path            | NOT TESTABLE                                 |

(The live product is still the demo build, so items 4, 5 and 7 would fail by construction today,
as recorded on the first run.)

## TWO-PERSON FLOW

Not verified on production (no browser contexts, no cloud build). The hermetic cloud-path suite
still proves the mechanism (realtime, partner hydration, no cross-writes); the physical two-phone
experience belongs to the pilot.

## DAILY LOOP

Not smoked on production (demo build live). Hermetic browser suite green at HEAD (8/8, previous run).

## LEGACY PHONE DATA

Preserved, not imported, not deleted — proven by the new `cloud-path` test: a pre-cloud
`elenas-plate:v1` snapshot is left byte-for-byte intact, no cloud rows derive from it, the retired
importer is fenced by its markers, and new logging writes to the cloud only. M1-R5 stays pending.

## PILOT

`docs/claude-tasks/M2_7_PILOT.md`: three ordinary days of normal use by both, a one-line friction
log (date/time · who · what I was trying to do · what felt slow/confusing/wrong · blocker/annoying/minor
· optional note), the sync/build cues the app already shows, known non-blocking limitations, and the
fields to record at start (date, deployed SHA, deployment id, acceptance result). Starts the day M1
closes.

## TESTS

`npm run preflight -- --live` FAIL (expected on the old publish) · cloud-path 13/13 · typecheck 0 ·
lint 0/8 · vitest 302 passed / 15 skipped · build OK. Live acceptance not executed.

## GIT

`main` @ the docs/test commit after `2f90d75` (see `git log`), pushed to `origin/main`.

## DOCUMENTATION

`docs/claude-tasks/RUN_2026-09-18_M1_CLOSE_ATTEMPT.md` (+ `.prompt.md`), `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`,
`docs/claude-tasks/M2_7_PILOT.md`, `docs/project-status.md`, `docs/todo.md`, `docs/claude-context.md`,
`src/lib/sync/cloud-path.test.tsx`.

## YOU

M1 cannot close without you — the three steps, now each a link in `M1_RELEASE_ACCEPTANCE.md` §1:

1. Open <https://github.com/arieldeitch/my-elenas-plate/edit/main/.env.production>, replace the last
   commented line with `VITE_SUPABASE_ANON_KEY=<anon/publishable key>` (Supabase → Project Settings →
   API Keys; never `service_role`), commit to `main`.
2. Open <https://lovable.dev/projects/ca9aedab-a0ca-4889-a545-9d673febf3a0> → Publish / Update.
3. Open <https://supabase.com/dashboard/project/rqgoiuztphkcvbwtbxbj/sql/new> → run
   `supabase/verify_privileges.sql`, then `supabase/apply_m1_grants_production.sql`, then
   `verify_privileges.sql` again; paste the last output into the next run.

Then tell the next run "owner actions done": it runs `npm run preflight -- --live`, the DB check and
the ten live checks, closes M1 and starts the pilot. Until then, keep using the app as you do; the
pilot starts only on the cloud build.

## NEXT

M2-8 will be selected from the real-device friction log after the pilot.

## RUN TIMESTAMP

2026-09-18 13:26 local time (Israel Standard Time), on the second computer.
