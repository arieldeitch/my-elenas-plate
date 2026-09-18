# Task prompt — run of 2026-09-18 (eleventh run, 8-hour reliability/hardening window) — verbatim as received; list markers may be normalized by prettier

You have up to 8 hours for one autonomous run on the Nutrition App.

Use the time aggressively but intelligently.

Do NOT manufacture work merely to consume the full window.
Do NOT stop after the first green test suite.
Do NOT ask the user for routine approvals.
Do NOT wait idle on an external blocker.

Work until the high-value verification/hardening work is exhausted.

Expected starting point:

`main @ fd32a38`

First verify actual:

- branch;
- HEAD;
- origin/main;
- worktree.

# EXTERNAL STATE — IMPORTANT

The controlling GPT has already applied the reviewed production migration:

`20260918160000_anonymous_device_join`

to Supabase project:

`rqgoiuztphkcvbwtbxbj`

It was verified after apply:

- exactly one household;
- exactly two product profiles:
  - Ariel
  - Elena;
- 390 active foods;
- `bootstrap_household()` is the DEC-031 device-join version;
- `pg_advisory_xact_lock` is present;
- `authenticated` can execute it;
- unauthenticated `anon` cannot execute it;
- migration ledger contains `20260918160000`;
- RLS remains enabled on all 10 public tables.

Do NOT reapply the migration.

Lovable has also been asked to publish the current no-login build.

One control-plane blocker may still exist:

Supabase Auth:
`external_anonymous_users_enabled`

was OFF in the last verified state.

The current ChatGPT Supabase connector cannot change that provider-level setting.

The controlling GPT may enable it externally during your run.

Do NOT block your 8-hour run waiting for it.

Check the anonymous-auth endpoint occasionally at logical milestones, not continuously.

---

# PRIMARY PURPOSE

This is NOT an M2 feature sprint.

The goal is to make the application boringly reliable for Ariel and Elena's real three-day pilot.

Focus on:

1. zero-friction anonymous access;
2. one shared household;
3. correct Ariel/Elena ownership;
4. realtime shared truth;
5. offline/reconnect/session recovery;
6. queue correctness;
7. mobile UX;
8. RTL;
9. accessibility;
10. release reliability;
11. narrowly scoped security hardening.

Do not implement M2-8.

---

# OPERATING RULES

Use the existing OS/project workflow.

Start from canonical repo context.

No Docker.

Use the existing Bun workflow.

Preserve:

- GitHub = implementation truth;
- Supabase = backend truth;
- repo docs = executable project context.

Make coherent commits.

Routine reversible improvements may be merged/pushed without asking Ariel.

Do not make destructive production changes.

Do not execute generic `supabase db push`.

Do not weaken RLS.

Do not expose service-role credentials.

Do not add synthetic production food/health data.

---

# WORKSTREAM A — BASELINE / REGRESSION GATE

Run the complete meaningful baseline first:

- install verification if needed;
- typecheck;
- lint;
- full Vitest;
- hermetic browser suite;
- production build;
- preflight --env;
- migration/PGlite tests;
- any relevant existing access-flow suites.

Record exact numbers.

Do not assume the previous 315-pass report still applies.

If something fails:
find root cause, not just retry.

---

# WORKSTREAM B — AUTH FLOW AUDIT

Perform a detailed code-path audit of:

- `AuthGate`;
- `ensureSession`;
- Supabase client initialization;
- auth-state listeners;
- `use-supabase-sync`;
- household bootstrap;
- device profile;
- queue adoption;
- reconnect behavior.

Look specifically for race conditions such as:

- `getSession()` and `onAuthStateChange()` both activating;
- two simultaneous `signInAnonymously()` calls;
- rapid reload producing multiple anonymous identities;
- AuthGate and sync hook bootstrapping independently;
- retry button producing concurrent calls;
- auth session appearing after component unmount;
- Realtime starting before token is installed;
- stale closure using a prior user ID.

Fix demonstrated risks with the smallest architecture-preserving change.

Add regression tests.

---

# WORKSTREAM C — AUTH STORM / RATE-LIMIT SAFETY

Anonymous Auth has a platform rate limit.

The UI must not accidentally create anonymous users in a retry loop.

Test:

1. fresh app;
2. anonymous provider disabled;
3. network failure;
4. repeated Retry taps;
5. online/offline flapping;
6. React remount;
7. tab background/resume;
8. rapid reload.

Ensure one logical connection attempt does not fan out into multiple sign-up requests.

If needed, add:

- in-flight deduplication;
- small local backoff;
- retry-state protection.

Do not add complicated infrastructure.

---

# WORKSTREAM D — HOUSEHOLD JOIN DEEP VERIFICATION

Use the real migration SQL in the existing PGlite/in-process Postgres harness.

Expand tests beyond the current basics.

Prove:

- first ever identity creates at most one household;
- existing historical household wins;
- device 2 joins it;
- device 3 joins it;
- 20 concurrent first-time joins still create one household;
- repeated bootstrap is idempotent;
- two profiles only;
- profile slugs are stable;
- food catalog remains attached to the same household;
- historical permanent account still joins/retains access;
- unauthorized/no-JWT caller cannot bootstrap;
- unauthenticated `anon` cannot call the RPC;
- authenticated non-member before bootstrap cannot see household rows;
- immediately after bootstrap it can see only that household.

Do not redesign the single-household architecture.

---

# WORKSTREAM E — MULTI-DEVICE SIMULATION

Create/extend a deterministic test harness for at least:

- Device A = Ariel
- Device B = Elena
- Device C = fresh device

Simulate independent auth user IDs.

Prove:

A adds entry
→ B sees it on partner day.

B adds entry
→ A sees it.

C joins later
→ same cloud state.

Then:

A changes Elena quantity after explicitly switching profile
→ only Elena's entry changes.

B reloads
→ truth persists.

Device profile selection must remain local to each device.

Authentication user ID must never become product identity.

---

# WORKSTREAM F — REALTIME LIFECYCLE

Audit Realtime carefully.

Test:

- access token is set before subscribing;
- only one household subscription is active;
- session refresh does not duplicate subscriptions;
- person switch does not create a second household subscription;
- date navigation does not leak subscriptions;
- sign-out/session replacement tears down old subscriptions;
- reconnect re-subscribes once;
- duplicate Realtime events do not duplicate rows;
- own optimistic write + incoming Realtime echo resolves cleanly;
- rapid updates converge to the final cloud value.

Measure subscription count where possible.

Fix leaks, races and duplicate-processing bugs if found.

---

# WORKSTREAM G — OFFLINE / RECOVERY

This is a phone app in practice even though it is a web app.

Test realistic failure sequences:

## Scenario 1

online
→ log food
→ sync
→ offline
→ log second food
→ close/reopen
→ online
→ queue drains.

## Scenario 2

offline before app boot
→ existing Supabase session available locally
→ app should degrade sensibly.

## Scenario 3

session storage cleared
→ new anonymous identity
→ same household join
→ existing cloud day reappears.

## Scenario 4

pending queue created under old anonymous identity
→ browser loses auth session
→ new identity joins same household
→ queue adoption behaves exactly as DEC-031 intends.

## Scenario 5

network dies during quantity `+++`
→ reconnect
→ one correct final quantity.

Prove no silent data loss.

---

# WORKSTREAM H — LEGACY LOCAL DATA

Preserve the existing rule:

old `elenas-plate:v1` phone data is:

- not imported;
- not deleted;
- not allowed to override cloud truth.

Test it again with the new anonymous-session recovery path.

Especially test:

legacy localStorage

- no auth session
  → anonymous connection
  → household join
  → cloud hydration

Result must remain cloud-only.

---

# WORKSTREAM I — MOBILE / RTL DEEP QA

Use real RTL.

At minimum:

- 360×740
- 412×915

Cover:

1. first-device person chooser;
2. loading state;
3. connection failure + Retry;
4. full Home;
5. empty day;
6. partially filled day;
7. full six-slot day;
8. partner glance;
9. MealEditor;
10. typed search;
11. recent chip;
12. quantity stepper;
13. weight/volume fallback;
14. Day Review;
15. fasting editor;
16. workout editor;
17. weigh-in;
18. past date;
19. long food names;
20. multiple foods in one slot.

Check:

- no horizontal overflow;
- no clipped bottom actions;
- keyboard does not hide important controls;
- safe-area behavior;
- scroll containment;
- logical RTL placement;
- Hebrew + numeric quantity order;
- focus behavior after add;
- no accidental double tap actions.

Fix actual UX defects.

Do not add new product features.

---

# WORKSTREAM J — ACCESSIBILITY

Run axe where practical.

Manually inspect:

- focus order;
- dialog focus;
- Escape behavior;
- touch targets;
- accessible names;
- Retry state;
- person chooser;
- search results;
- +/- controls;
- trash/edit/star actions;
- Day Review toggle;
- states not conveyed by color alone.

Fix meaningful defects only.

---

# WORKSTREAM K — PERFORMANCE / NETWORK BUDGET

Instrument enough to answer:

- reads on activation;
- reads when opening MealEditor;
- reads opening Day Review;
- reads switching partner;
- writes for quick add;
- writes for rapid quantity changes;
- number of Realtime subscriptions;
- rerenders caused by auth events.

Look for:

- accidental duplicate hydration;
- N+1 reads;
- duplicate partner hydration;
- unnecessary refetch on dialog open;
- repeated bootstrap;
- write amplification.

Keep the existing architecture.

Do not introduce a new state library.

---

# WORKSTREAM L — SECURITY HARDENING REVIEW

Review current Supabase advisor findings and current code.

Known findings included:

- mutable `search_path` on `set_updated_at`;
- SECURITY DEFINER function exposure;
- leaked-password protection disabled;
- some performance/index notices.

Anonymous-auth migration already revoked:

`bootstrap_household()` from public/anon.

Re-run/reevaluate the effective state conceptually and in available test environments.

For each advisor finding classify:

- FIX NOW — tiny, obviously safe, directly relevant;
- POST-PILOT — useful but not blocking;
- INTENTIONAL — required by architecture;
- NOT APPLICABLE.

Do not turn this into a broad schema rewrite.

If `set_updated_at` can be safely hardened with a pinned search_path and schema-qualified calls without behavioral change, implement/test a clean migration.

For `is_household_member` SECURITY DEFINER:
do not blindly change it to SECURITY INVOKER — it exists to avoid RLS recursion.

For function EXECUTE:
determine the minimal safe grant set based on actual policy evaluation.

Any new migration created during this run:

- test locally/in PGlite where applicable;
- document;
- DO NOT apply to production automatically unless it is genuinely required to fix a release blocker and the existing deployment protocol explicitly permits it.

---

# WORKSTREAM M — LINK-AS-ACCESS-SECRET THREAT REVIEW

DEC-031 currently means any person who can reach the app and obtain an anonymous authenticated session can ultimately join the single household.

Ariel explicitly prioritizes frictionless access and considers the stored information low sensitivity.

Do NOT redesign access during this run.

But perform a concise threat review:

- discoverability of lovable.app URL;
- impact of a stranger joining;
- what they could read/write under current RLS;
- anonymous account accumulation;
- abuse/rate-limit implications.

Identify the smallest future mitigation options, for example:

- unguessable join token in URL;
- device join code;
- revoke/join reset mechanism.

Do not implement them unless you uncover a release-level vulnerability that makes the current pilot unreasonable.

Keep the assessment proportionate to this low-sensitivity couple app.

---

# WORKSTREAM N — SEARCH / DAILY LOOP REGRESSION

Re-run the complete intended flow after all auth/realtime changes:

Home
→ meal tile
→ recent chip
→ quantity +
→ finish
→ typed search result
→ weight-first fallback
→ skip meal
→ fasting
→ workout
→ Day Review
→ partner glance.

Verify the auth simplification did not regress M2-1 through M2-6.

No new feature work.

---

# WORKSTREAM O — PRODUCTION RELEASE READINESS

Inspect:

- `.env.production`;
- build-info generation;
- release preflight;
- RuntimeGate;
- absence of old login strings/components;
- absence of secret/service-role material;
- `VITE_RUNTIME_TARGET=shared`;
- current Supabase host.

Ensure production build cannot silently fall back to demo.

Ensure the normal build does not contain active email/password login UX.

---

# EXTERNAL AUTH SETTING CHECK

At logical milestones — not more than necessary — test whether production anonymous sign-in has become enabled.

When it becomes enabled:

perform a fresh production-browser smoke:

URL
→ no login form
→ anonymous session established
→ person chooser appears.

Do NOT create fake nutrition entries in production.

It is acceptable for the fresh browser to create its device membership through the intended bootstrap; document that test session.

Then verify:

- household returned is the historical household;
- profiles = Ariel/Elena;
- catalog available;
- footer = cloud;
- reload reuses session;
- no second membership for the same browser session.

If anonymous sign-in remains disabled for the whole run:

do not sit idle.

Finish all repo-side work and report that one external control-plane switch remains.

---

# BUG FIX PRIORITY

Fix:

P0:

- data loss;
- cross-person corruption;
- duplicate household;
- auth loop;
- inability to enter app;
- broken Realtime;
- production/demo confusion.

P1:

- obvious daily-loop breakage;
- offline recovery failure;
- mobile unusability;
- significant accessibility issue.

P2:

- small polish issue.

Do NOT spend the 8-hour window polishing P2 while P0/P1 investigation remains.

---

# DO NOT ADD

No:

- calories;
- protein/macros;
- AI;
- barcode scanning;
- notifications;
- reactions/comments;
- streaks;
- meal templates;
- repeat-yesterday;
- new dashboards;
- analytics platform;
- new backend tables unrelated to a proven bug;
- generic account-management system.

M2-8 is frozen until real-device evidence exists.

---

# GIT

Use coherent commits.

Before every push:

- inspect diff;
- remove debug logs;
- scan for credentials;
- run relevant tests;
- keep history clean.

No force-push.

Push green, reversible work to main under the existing project policy.

---

# DOCUMENTATION

Preserve context fully.

Update only canonical docs:

- run prompt/report;
- project status;
- TODO;
- decisions only for durable architectural decisions;
- Claude context;
- acceptance/pilot docs if the facts changed;
- exact last-run date/time.

Record prompts and final response.

Do not create redundant documentation trees.

---

# END-OF-RUN STANDARD

Do not say GREEN merely because tests pass.

The final assessment must separate:

- repo correctness;
- backend correctness;
- production deployment;
- anonymous-auth provider state;
- real-device readiness;
- unresolved risks.

---

# REQUIRED FINAL REPORT

Use exactly:

## STATUS

Include:

- repository
- backend
- production
- anonymous auth
- M1
- M2-7

## STARTING STATE

## WORK COMPLETED

High-level list of what you actually did during the long run.

## ACCESS FLOW

Exact final behavior.

## AUTH / SESSION

Races, retry, rate-limit protection, session persistence.

## HOUSEHOLD JOIN

Concurrency/idempotence evidence.

## DEVICE IDENTITY

Ariel / Elena correctness.

## MULTI-DEVICE

What was proven.

## REALTIME

Subscription/token/convergence findings.

## OFFLINE / RECOVERY

All meaningful scenarios and results.

## LEGACY DATA

Confirmation.

## DAILY LOOP

M2 regression result.

## MOBILE / RTL

Both viewport findings.

## ACCESSIBILITY

## PERFORMANCE

Reads/writes/subscription findings.

## SECURITY HARDENING

For every advisor item:
FIXED / POST-PILOT / INTENTIONAL / NOT APPLICABLE.

## PRODUCTION

Live checks actually executed.

## ANONYMOUS AUTH SETTING

ON/OFF and how verified.

## TESTS

Exact commands/counts.

## GIT

Starting SHA → ending SHA(s), origin/main and worktree.

## DOCUMENTATION

Exact files.

## YOU

Only actions Ariel genuinely still needs to perform.
Prefer zero.

## NEXT

If anonymous auth is ON and production smoke passes:

`Two-phone §3b → M1 CLOSED → M2-7 real-device pilot.`

If it is still OFF:

`Enable the one Supabase anonymous-auth provider switch → publish if needed → §3b.`

Do NOT select M2-8.

## RUN TIMESTAMP

Exact Israel local date/time.

Be autonomous.
Be skeptical.
Keep going after the first green gate.
Use the long window for depth, not feature creep.
