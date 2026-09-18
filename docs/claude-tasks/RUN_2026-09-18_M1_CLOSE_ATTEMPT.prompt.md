# Task prompt — run of 2026-09-18 (eighth run, M1 close attempt / M2-7 prep) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App directly from the current repository state.

Expected starting point:

`main @ 2f90d75`

This is NOT a feature-development run.

The daily M2 loop is now intentionally considered sufficiently optimized for first real-world use.

Do not invent M2-7 features.

The purpose of this run is:

# CLOSE M1 IN PRODUCTION

and then

# PREPARE / EXECUTE M2-7 REAL-DEVICE VALIDATION

Read the latest canonical project status, decisions, TODO, M1 release checklist and M2-6 run record before acting.

Verify actual branch / HEAD / origin / worktree first.

---

# CURRENT PRODUCT TRUTH

M2 currently supports a low-friction daily loop:

Home
→ meal
→ recent/search result
→ direct add
→ optional quantity +/−
→ finish
→ Day Review.

Major established capabilities include:

- couple-first home;
- partner glance;
- explicit ownership;
- six meal slots;
- one-tap quick add;
- safe direct add from search;
- inline quantity stepping where semantics are trustworthy;
- Day Review;
- compact weight/workout/fasting context;
- honest sync indication;
- production runtime fail-safe;
- release preflight;
- build identity;
- mobile/RTL coverage.

Do not reopen these decisions without evidence of a defect.

---

# PHASE 1 — FAST STATE CHECK

Verify:

- branch;
- HEAD;
- origin/main;
- clean/dirty worktree;
- latest M1 release checklist;
- whether Ariel's owner actions were actually completed.

Do not assume they succeeded merely because the user says they were attempted.

Verify with evidence.

---

# PHASE 2 — PRODUCTION BUILD VERIFICATION

Run the canonical live preflight.

Expected:

`npm run preflight -- --live`

Verify:

- live deployment is no longer the old demo deployment;
- `/build-info.json` exists;
- build SHA maps to current/known Git main;
- runtime target is shared/cloud;
- Supabase is configured;
- correct Supabase host is embedded;
- no service-role key is exposed;
- fail-safe is not blocking the live product;
- footer/runtime diagnostic reports cloud, not demo.

If preflight fails:

investigate the concrete reason.

Do NOT resume feature development.

Fix only release/configuration issues within established architecture.

---

# PHASE 3 — PRODUCTION DATABASE VERIFICATION

Use the existing production-safe procedure.

Target project:

`rqgoiuztphkcvbwtbxbj`

Confirm the owner ran:

1. `supabase/verify_privileges.sql`
2. `supabase/apply_m1_grants_production.sql`
3. `supabase/verify_privileges.sql`

Verify resulting state.

Do NOT run generic:

`supabase db push`

against production.

Confirm:

- expected grants;
- expected migration ledger rows;
- RLS remains active;
- anon access is not accidentally widened;
- production data was not destructively modified.

If you have direct production access in this session, use it read-only for verification where possible.

Do not repeat already-reviewed migration architecture.

---

# PHASE 4 — LIVE M1 ACCEPTANCE

This is the critical milestone.

Use the canonical:

`docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`

Perform the ten live checks against the actual deployed product.

Do not substitute hermetic tests for live acceptance.

Verify at minimum:

1. identity/person selection;
2. Ariel attribution;
3. Elena attribution;
4. shared visibility;
5. cross-person propagation;
6. refresh persistence;
7. cloud truth vs stale local state;
8. correct edit ownership;
9. authorization boundary;
10. normal daily-use path.

Classify each:

`PASS`
`FAIL`
`NOT TESTABLE`

M1 may be marked CLOSED only if all required critical checks genuinely pass.

Do not report GREEN from deployment success alone.

---

# PHASE 5 — TWO-PHONE / TWO-PERSON REALITY

The product goal is not merely:

"Supabase contains rows."

It is:

"Ariel and Elena see the same shared reality correctly on their own phones."

If you have access to two independently isolated browser contexts, use them to approximate this:

Context A = Ariel
Context B = Elena

Verify:

Ariel adds food
→ Elena's view reflects the correct partner state through the supported refresh/sync mechanism.

Elena adds food
→ Ariel sees her partner state correctly.

Verify no ownership crossing.

If two real devices are not accessible to Claude, document this as part of M2-7 human validation rather than pretending browser isolation proves the physical-device experience.

---

# PHASE 6 — PRODUCTION LOCALSTORAGE SAFETY

The old live app stored data locally.

The new cloud app must not silently contaminate shared production truth with old demo data.

Verify current behavior against M1-R5:

- old `elenas-plate:v1` data remains preserved;
- it is not automatically imported;
- it is not deleted;
- no duplicate cloud rows appear because legacy local state exists.

Do NOT implement migration/import.

M1-R5 remains a separate decision.

If the cloud application correctly starts fresh while preserving old local data, that is acceptable.

---

# PHASE 7 — SMOKE THE COMPLETE DAILY LOOP

On the actual production build, exercise the current M2 daily loop:

Home
→ choose a meal
→ add recent/direct search food
→ adjust count quantity
→ add a weight/volume food through fallback
→ finish
→ inspect Home
→ inspect Day Review
→ inspect partner view
→ reload.

Verify:

- correct owner;
- selected date;
- selected slot;
- quantities;
- latest activity;
- slot documented state;
- Day Review;
- sync status.

The objective is to ensure the highly optimized hermetic experience survived real deployment.

---

# PHASE 8 — REAL-DEVICE VALIDATION PLAN

Once M1 production is genuinely closed, prepare the smallest possible human validation protocol.

This is NOT a long QA checklist.

We want Ariel and Elena to use the product normally for approximately three days.

Create a simple friction log requiring minimal effort.

Each observed issue should capture only something like:

- timestamp/date;
- who: Ariel / Elena;
- action attempted;
- what felt slow/confusing/wrong;
- severity:
  - blocker;
  - annoying;
  - minor;

- optional short note/screenshot reference.

Do not ask them to score dozens of UX categories.

Real use is the experiment.

---

# PHASE 9 — IN-APP FEEDBACK ONLY IF TRULY TINY

Do NOT build a feedback system by default.

If there is already a trivial existing mechanism that can capture a short friction note without backend/schema work, you may consider exposing it.

Otherwise:

do not add one.

A simple external/manual observation log is sufficient for M2-7.

The product should be used, not instrumented to death.

---

# PHASE 10 — OBSERVABILITY FOR THE 3-DAY PILOT

Verify that obvious failures during the pilot will be distinguishable.

At minimum the user experience should make clear:

- synced;
- pending/offline;
- failed to sync.

Do not introduce technical debugging UI.

Existing runtime/build diagnostics should remain available for troubleshooting but unobtrusive.

If current telemetry/logging is sufficient, leave it alone.

Do not add analytics infrastructure merely for M2-7.

---

# PHASE 11 — STOP FEATURE DEVELOPMENT

This is important.

Do NOT implement:

- repeat yesterday;
- meal templates;
- default gram amounts;
- AI;
- nutrition calculations;
- notifications;
- reactions;
- new search ranking;
- barcode scanning;
- gamification;
- new dashboards.

Even if they sound useful.

The next product milestone must be based on evidence from the real two-person pilot.

If you notice a potential enhancement during this run:

record it as an observation/candidate only.

Do not build it unless required to fix a blocking production defect.

---

# PHASE 12 — DOCUMENT PROJECT STATE

If M1 passes:

change project status clearly to:

`M1 CLOSED`

with exact evidence/date/build SHA.

Then set current milestone:

`M2-7 — REAL DEVICE PILOT`

Record:

- deployed SHA;
- deployment ID;
- production Supabase project;
- M1 acceptance result;
- pilot start date;
- known non-blocking limitations.

Ensure stale documentation no longer claims production is demo/local-only once that is no longer true.

If M1 does NOT pass:

keep it YELLOW and document the exact failing acceptance item.

---

# TESTING

Do not burn time rerunning every test unnecessarily if HEAD is unchanged and previous CI-equivalent suite is green.

Run tests relevant to any code/config fixes made.

At minimum for release verification:

- live preflight;
- build identity;
- live acceptance.

If code changes are made:

run the appropriate typecheck/lint/unit/browser/build suite before push.

---

# GIT

If no code/config change is required:

do not create meaningless code commits.

Documentation/status evidence commits are acceptable if canonical project state changed.

If a production-release fix is needed:

- make the smallest correction;
- test;
- commit;
- push;
- republish if required;
- verify again.

No force-push.

---

# SUCCESS CONDITION

The ideal end state is:

## M1

CLOSED.

## LIVE APP

Current main deployed and confirmed cloud-backed.

## SHARED TRUTH

Ariel and Elena correctly separated but mutually visible.

## DAILY LOOP

Validated on real production.

## M2-7

Three-day real-device pilot begins.

## DEVELOPMENT

Feature work intentionally paused pending real evidence.

---

# REQUIRED FINAL REPORT

Use exactly:

## STATUS

Overall plus:

- M1
- M2-7
- production
- repository

## STARTING STATE

Branch, SHA, worktree/origin.

## LIVE BUILD

Deployment ID, build SHA, runtime target and cloud/demo state.

## PRODUCTION DATABASE

Migration/grant verification only.

## M1 ACCEPTANCE

All ten checks:
`PASS / FAIL / NOT TESTABLE`

## TWO-PERSON FLOW

What was actually verified.

## DAILY LOOP

Production smoke result.

## LEGACY PHONE DATA

Confirm whether preserved / imported / untouched.

## PILOT

Exact three-day M2-7 validation protocol.

## TESTS

Only checks actually executed.

## GIT

Ending SHA and push status.

## DOCUMENTATION

Exact canonical files updated.

## YOU

Only actions Ariel still genuinely needs to perform.

If M1 closed and the pilot can start:
state explicitly that Ariel and Elena should now use the application normally rather than perform artificial QA.

## NEXT

Do NOT select M2-8 yet.

Write:

`M2-8 will be selected from the real-device friction log after the pilot.`

## RUN TIMESTAMP

Exact local date/time and update the canonical last-run record.

Do not resume speculative feature development.
