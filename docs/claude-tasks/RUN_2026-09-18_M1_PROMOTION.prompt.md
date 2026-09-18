# Task prompt — run of 2026-09-18 (verbatim as received; list markers normalized by prettier)

You are continuing the Nutrition App recovery project from the CURRENT repository state.

This is an execution run, not another architecture/discovery exercise.

## CURRENT VERIFIED STATE

The previous run ended GREEN with:

- M1 shared-truth recovery verified successfully on the isolated Supabase branch/environment.
- Backend verification suites passed.
- Verified commit:
  `edc2d54da72bdcd1ac73952253606d442`
- The next intended sequence was:
  1. review/approve the pending grants migration;
  2. apply it to production safely;
  3. publish/deploy the application through the actual deployment path;
  4. verify build identity;
  5. verify the live application against production.

There was also an unexpected behavior during the previous Claude run:
**Docker/Desktop appears to have started automatically when Claude began working.**
We previously intended to avoid unnecessary Docker auto-start behavior.
Investigate this during this run and fix it if it can be done safely without compromising the project environment.

---

# FIRST: RECOVER THE LOCAL CONTEXT ON THIS COMPUTER

This run may be executing on a different computer from previous runs.

Do not assume the local checkout is correct.

Before changing anything:

1. identify the current Git repository and remote;
2. run appropriate Git sanity checks:
   - remote(s);
   - current branch;
   - HEAD;
   - status;
   - worktree cleanliness;
   - upstream relationship;

3. fetch from origin;
4. confirm that commit
   `edc2d54da72bdcd1ac73952253606d442`
   exists in the repository history;
5. identify the branch containing it and the intended production/default branch;
6. inspect any commits made after that SHA before proceeding;
7. do not overwrite, discard, reset, or clean uncommitted local work unless you have positively established that it is disposable.

If the local repository is incomplete or stale, recover from GitHub rather than reconstructing state manually.

GitHub remains the source of truth for implementation.

---

# OPERATING SYSTEM / PROJECT INSTRUCTIONS

At the beginning of the run, inspect the repository for the latest project-level operating instructions, task files, run logs, handoff documents, and shared working conventions.

Prefer the latest repo-local instructions over stale assumptions.

Claude must NOT depend on direct Google Drive access in order to execute this project.

If project instructions or handoffs are canonically maintained elsewhere, the active executable instruction set must also exist in the repository.

Preserve context aggressively:

- task/prompt sent into this run;
- material discoveries;
- commands/actions that change external state;
- resulting commits;
- migration/deployment evidence;
- final Claude report.

Do not create speculative architecture documentation merely to produce documentation.

---

# PRIMARY OBJECTIVE

Complete the safe production promotion and live verification of M1.

The run is successful only if the production path is either:

A. verified GREEN end-to-end,

or

B. stopped at a precisely documented blocking condition with no false claims of success.

Do not stop simply because one step requires investigation.
Work autonomously through recoverable problems.

---

# PHASE 1 — RECONSTRUCT THE EXACT M1 DELTA

Starting from the verified commit and current HEAD:

1. inspect the M1 changes;
2. identify every database migration related to M1;
3. identify specifically the pending/new grants migration referenced by the previous run;
4. establish whether it has:
   - already been applied to production;
   - been partially applied;
   - not been applied;

5. compare migration history between:
   - repository;
   - isolated/test Supabase environment used for verification;
   - production Supabase;

6. verify that production is the intended Supabase project before touching it.

Production project identity must be positively verified.

Do not trust filenames or assumptions alone.

---

# PHASE 2 — SECURITY / GRANTS REVIEW

Before applying the pending migration, independently review it.

Check at minimum:

- grants/revokes;
- authenticated vs anon access;
- schema privileges;
- table privileges;
- sequence privileges where applicable;
- function execution rights;
- SECURITY DEFINER functions;
- search_path hardening;
- RLS interaction;
- owner/member/shared-truth behavior;
- accidental privilege widening;
- backward compatibility with the running client.

Compare the intended production state with the state already verified in the isolated environment.

If the migration would widen access beyond what M1 requires, stop and correct it before production application.

No destructive production-data migration is authorized in this run unless it is already part of the previously reviewed M1 plan and can be proven safe.

---

# PHASE 3 — PRODUCTION MIGRATION

If the review is GREEN:

1. make a production-safe preflight;
2. capture enough current state to verify before/after behavior;
3. apply ONLY the required pending migration(s);
4. verify the migration record/state;
5. run production-safe verification queries/tests.

Do not modify production data merely to create a test case if an existing safe test path is available.

Do not report migration success based only on command exit code.
Verify the resulting database state.

---

# PHASE 4 — DEPLOYMENT / BUILD IDENTITY

After backend production state is verified:

Determine the REAL deployment path of the application.

Do not assume that:

- GitHub HEAD,
- Lovable project state,
- deployed frontend,
- and production Supabase

are synchronized.

Explicitly prove the chain.

At minimum determine:

GitHub commit
→ branch
→ Lovable/project sync state
→ build/deployment
→ live URL/build
→ production Supabase target.

Publish/deploy only through the established legitimate project path.

After publication, verify build identity.

Use a deterministic indicator where possible:

- commit SHA;
- generated build metadata;
- deployment identifier;
- source map/build artifact evidence;
- or another reliable mechanism.

"Lovable says published" is not sufficient evidence by itself.

If no reliable build-identity mechanism currently exists and it can be added safely with minimal scope, implement one.

Do not expose secrets.

---

# PHASE 5 — LIVE M1 ACCEPTANCE

Perform a focused production acceptance test of the M1 shared-truth behavior.

This application is a two-person nutrition application.

Test the critical shared-state journeys that M1 is intended to recover.

At minimum verify from the actual production application/backend:

1. identity/person selection behaves as intended;
2. Ariel-side data is attributed correctly;
3. Elena-side data is attributed correctly;
4. shared visibility behaves correctly;
5. changes from one side become visible to the other as intended;
6. refresh/reload does not silently revert the state;
7. duplicate/local stale state does not override production truth;
8. editing does not mutate the wrong person's data;
9. authorization prevents unintended cross-user mutation;
10. the basic daily-use path still works after the migration/deployment.

Classify each acceptance item as:

`PASS`
`FAIL`
`NOT TESTABLE`

Do not convert NOT TESTABLE into PASS.

Where an automated test can reasonably encode a discovered regression, add it.

---

# PHASE 6 — DOCKER AUTO-START INVESTIGATION

During this run, investigate why Docker/Desktop started when Claude began working.

Goal:
**Claude/project startup should not launch Docker unless Docker is actually required for the task.**

Determine whether the trigger is caused by:

- Docker Desktop Windows startup configuration;
- VS Code/devcontainer behavior;
- Claude hooks/scripts;
- repo scripts;
- package scripts;
- Supabase CLI local-development commands;
- WSL integration;
- another project bootstrap mechanism.

Do not break functionality merely to suppress Docker.

If Docker is NOT required for the normal Nutrition App workflow:

- disable/remove the project-specific automatic trigger safely;
- leave explicit manual/local-dev Docker workflows available if useful;
- document the change.

If the trigger is an OS-level Docker Desktop setting rather than something safely controllable from the repo:

- do not make uncontrolled machine-wide changes;
- identify the exact setting/process responsible;
- report the precise recommended change for Ariel.

If Docker IS genuinely required for a part of this workflow, explain exactly which part and prevent it from launching unnecessarily at unrelated times.

---

# PHASE 7 — CLEANUP, COMMIT, AND DOCUMENTATION

Any code/config/test/documentation changes produced by this run must end in a clean, understandable repository state.

Before finishing:

- run relevant tests;
- run build/typecheck/lint where available and appropriate;
- inspect `git diff`;
- remove debug artifacts;
- ensure no credentials/secrets entered the repo;
- commit coherent changes;
- push them when safe and consistent with the project workflow.

You have standing authorization to perform routine, reversible Git operations and merges that are clearly required by the approved project path.
Do not stop merely to request approval for an ordinary merge when tests and verification are GREEN.

For irreversible/destructive external actions, remain conservative.

---

# REQUIRED RUN RECORD

Preserve a repo-accessible record of this run.

At minimum capture:

- run objective;
- starting SHA;
- ending SHA;
- branch;
- production migration(s) applied;
- deployment/build identifier;
- live verification results;
- Docker finding/change;
- unresolved issues;
- next selected action.

Follow the repository's existing logging/location convention rather than inventing another parallel documentation system.

The final Claude report must also be saved in a repo-accessible location so that the next run does not depend on this terminal's chat history.

---

# REQUIRED FINAL REPORT

Finish with exactly these sections:

## STATUS

`GREEN`, `YELLOW`, or `RED`

## STARTING STATE

Branch + starting SHA + whether working tree was clean.

## CHANGES

Exactly what changed in Git, Supabase, Lovable/deployment, and local configuration.

## PRODUCTION DATABASE

What migrations/grants were reviewed and applied, with verification evidence.

## BUILD IDENTITY

Exact relationship between deployed build and Git commit.

## LIVE ACCEPTANCE

Table/list of M1 checks:
`PASS / FAIL / NOT TESTABLE`

## DOCKER

Why it started, whether it was fixed, and what remains.

## TESTS

Commands/checks executed and results.

## GIT

Ending branch, commit SHA(s), push/merge state.

## DOCUMENTATION

Exact repo paths written/updated.

## YOU

Only actions genuinely required from Ariel.
If none:
`Nothing`

## NEXT

One concrete next milestone/action already selected for the project.

## RUN TIMESTAMP

Include the exact local date and time when this run ended.

Do not claim GREEN unless the production state, deployment identity, and critical live M1 behavior have been verified with evidence.
