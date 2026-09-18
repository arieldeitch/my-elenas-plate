# M1 — Shared Truth Recovery

**Status:** Ready for implementation
**Branch:** `recovery/m1-shared-truth`
**Baseline:** `ada47d2d25dc401c9c4c8b347e39460b7770e3ba`
**Canonical product/audit reference:** Google Drive `AI Projects/04_Nutrition_App/02_Product_Architecture/TAKEOVER_AUDIT_AND_RECOVERY_PLAN`
**Supabase production project:** `rqgoiuztphkcvbwtbxbj`
**Development-environment policy:** `docs/NO_LOCAL_DOCKER_POLICY.md`

## 1. Objective

Make the existing application safe and reliable for two phones using the same shared household in real time.

The milestone is complete only when both devices converge on one authoritative Supabase state without destructive reconciliation, stale-device deletion, silent demo-mode behavior, or reload-dependent correctness.

This is a recovery task, not a rewrite.

## 2. Current architecture that MUST be preserved unless a test proves it impossible

- React + TypeScript + TanStack + Tailwind stack.
- Supabase is the production source of truth when configured.
- Current product authentication model is a **shared account/session** with two nutrition profiles: Ariel and Elena.
- Both profiles belong to one household.
- RLS remains household-scoped.
- Built-in catalog + remote catalog behavior stays intact.
- Existing public UX concepts (six meal slots, fasting, workout, weigh-in, favorites/recents) stay intact for M1.
- **No local Docker dependency.** The application runtime is Docker-free and the development/test workflow must also be Docker-free on Ariel's workstation by default.

Do **not** introduce separate-account invitations, a new household membership architecture, a new framework, a new database, or a large UI redesign in M1.

## 3. Important verified evidence

### 3.1 Unsafe day-level reconciliation

`src/lib/sync/supabase-sync.ts::pushDay()` currently:

1. upserts all statuses for a local day;
2. upserts every local food entry;
3. reads every remote food entry for the same profile/date;
4. deletes any remote entry not present in the local snapshot.

A stale device can therefore delete an entry created by the other device. This is the primary correctness defect.

### 3.2 Delete semantics are incomplete

Fasting and workout are upserted when present, but clearing them locally has no matching remote delete path.

### 3.3 Realtime is incomplete

The household subscription does not include `fasting_logs` or `workout_logs`.

The callback currently rehydrates the currently viewed profile/date for most events rather than reliably handling the affected profile/date.

### 3.4 Offline durability is not proven in the active path

`src/lib/sync/queue.ts` exists and is tested, but the active Supabase store path primarily uses in-memory dirty sets. M1 must prove that a mutation created offline survives a reload/crash and is persisted exactly once after reconnect.

### 3.5 Device/profile attribution is ambiguous

The shared-account architecture is intentional, so do **not** add `user_id -> profile_id` database mapping in M1.

However, every fresh store starts on local profile `me` (Ariel). A device primarily used by Elena can therefore start on Ariel and accidentally log to the wrong profile.

M1 should solve this as a **device preference**, not as nutrition source-of-truth data.

### 3.6 Runtime/deployment truth must be re-proven

The production repository documents that the running application pointed to Supabase project `rqgoiuztphkcvbwtbxbj` in July 2026, but publishing is manual through Lovable and there is no CI/CD or Git SHA embedded in the deployed artifact.

Current read-only inspection of that Supabase project shows the catalog/household baseline but no transactional nutrition rows. The current household memberships are QA/bootstrap accounts. Therefore M1 must re-prove what the currently published build is actually running before declaring production fixed.

### 3.7 Docker is not an application requirement

The repository has no Docker runtime/test script in `package.json`. Docker entered the project only because prior Supabase verification used `supabase start`, which launches the full local Supabase stack.

The existing live integration suites already support `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` and describe their target as remote **or** local. Therefore local Docker is a tooling choice, not an architecture requirement.

Ariel's workstation experiences unacceptable resource contention when the local Supabase Docker stack runs. M1 must follow `docs/NO_LOCAL_DOCKER_POLICY.md`:

- run hermetic/local tests without containers;
- run real Auth/RLS/Realtime/concurrency tests against an isolated hosted Supabase development branch or dedicated non-production test project;
- never use production as an automated mutation-test target;
- do not fall back to local Docker merely because prior project notes used it.

The Supabase organization is on the Pro plan and currently has no development branches. Provisioning a hosted test branch is an orchestration/release action, not permission for Claude to create one without the required cost/owner approval.

Production migration history currently records migrations through `20260723090400`, while the repository also contains `20260725190000_cleanup_mock_data_and_seed_food_catalog.sql`. The first hosted test branch must therefore be treated as a reproducibility check; do not assume its catalog/data matches production, and do not use this mismatch as a reason to run Docker locally.

## 4. Required implementation

### Phase A — Runtime truth and release identity

1. Add a non-secret build identity that can be observed in the running app or console, preferably a short Git SHA supplied at build time with a safe fallback for local development.
2. Make cloud/demo mode explicit. A production-like published build must never silently appear healthy while Supabase is not configured.
3. When Supabase is configured, remove/replace any copy claiming that data is stored only temporarily in the browser.
4. Document exactly how Lovable production receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` without committing secrets.
5. Do not modify production environment variables automatically. Report any missing runtime configuration as a blocker.

### Phase B — Per-device default profile

Preserve the shared Auth account.

Implement a lightweight device-level preference for `me` / `elena`:

- stored locally on that device only;
- used only to choose the default active profile;
- never treated as nutrition data or cloud source of truth;
- changeable from the UI;
- first-use behavior must be explicit enough that Elena does not silently start logging as Ariel.

A small one-time chooser such as `מי משתמש/ת במכשיר הזה?` is acceptable. Keep this implementation minimal; do not redesign the whole home screen in M1.

### Phase C — Replace snapshot writes with operation-level mutations

Routine user actions must stop calling whole-day destructive reconciliation.

Use or extend the existing repository-level operations so that each user action produces a narrowly scoped, idempotent mutation, for example:

- add food entry by stable entry id;
- update one food entry by id;
- delete one food entry by id;
- set one meal status for one profile/date/slot;
- set or clear one fasting record;
- set or clear one workout record;
- insert weigh-in with stable/idempotent handling appropriate to the existing model;
- favorite/recent mutation remains profile-scoped.

Do not delete unrelated rows merely because they are absent from a local snapshot.

`pushDay()` may remain for a tightly controlled migration/recovery path if genuinely needed, but it must not be the routine write path for interactive edits.

### Phase D — Durable mutation queue

Wire the existing queue concept into the active cloud path, or replace it only if tests prove it unsuitable.

Required properties:

- mutations survive page reload;
- stable mutation ids / idempotent server writes prevent duplicates;
- order is preserved where ordering matters;
- failures are retried with bounded behavior;
- permanent failures become visible/recoverable rather than silently disappearing;
- Supabase remains source of truth after successful sync.

The queue must contain operations, not whole-day snapshots.

### Phase E — Realtime completeness

1. Subscribe to all user-visible mutable tables needed by the daily experience, including fasting and workout.
2. Use event payload metadata where possible to determine the affected profile/date/table.
3. A remote event must not overwrite an unsent local mutation.
4. If the affected entity is on the current screen, update/rehydrate it promptly; if it is the partner profile, retain enough state to surface it when the partner is viewed and to support the later couple-first UI.
5. Keep RLS/auth token handling intact.

### Phase F — Docker-free verification path

1. Do **not** run `supabase start`, local `supabase db reset`, Docker Desktop, Testcontainers, or a self-hosted Supabase stack on Ariel's workstation.
2. Run unit/component/sync-logic tests locally with Vitest.
3. Run Playwright without containers. Backend-dependent browser tests must point to the isolated hosted Supabase test environment.
4. Run RLS/Realtime/live-data suites only against a hosted isolated Supabase development branch or dedicated non-production test project.
5. If the hosted test environment is not yet provisioned, complete all hermetic implementation/testing that can be done safely, then report the real-backend integration gate as **pending**. Do not substitute production and do not silently launch Docker.
6. If any schema change is actually required, create/review explicit SQL migration files and validate them on the hosted test environment. Do not use a local Docker-backed schema-diff workflow by default.

## 5. Mandatory regression/concurrency tests

Add tests that fail on the current snapshot algorithm and pass after M1.

### Test 1 — stale-device same-day add/add

- Device A and B load the same profile/date.
- A adds entry X.
- Before B rehydrates X, B adds entry Y from its stale local state.
- Final Supabase state contains **X and Y exactly once**.

### Test 2 — unrelated delete safety

- A and B load the same profile/date.
- A adds X.
- B adds Y.
- A deletes X.
- Y must remain.

### Test 3 — two-profile isolation under concurrent use

- One context edits Ariel while another edits Elena.
- Both persist; neither profile is overwritten or cross-contaminated.

### Test 4 — fasting/workout clear

- Create fasting/workout on device A.
- Observe on B.
- Clear on A.
- B observes removal without reload.

### Test 5 — offline + reload + reconnect

- Go offline after full activation.
- Add a food entry.
- Reload/close and restore the app while still offline.
- Reconnect.
- Entry persists remotely exactly once and appears after a fresh reload.

### Test 6 — realtime insert/update/delete

Second context receives each operation without manual refresh. Keep the existing event-order safeguards discovered in prior tests.

### Test 7 — device default profile

- Choose Elena as the device default.
- Reload.
- Elena is active by default.
- Switching to Ariel still works.
- Nutrition data itself is never sourced from localStorage.

### Test 8 — cloud/demo mode truth

- With Supabase env present: auth/cloud path is active and demo-only persistence copy is absent.
- Without Supabase env: demo/development mode is clearly identifiable and cannot masquerade as production cloud sync.

### Test environment rule

Tests 1–6 that require real database/Auth/Realtime semantics must run against the isolated hosted Supabase test environment, **not** production and **not** local Docker on Ariel's workstation. Tests 7–8 should remain hermetic/browser-local wherever possible.

## 6. Safety constraints

- **No destructive production writes.**
- **Do not create more production Auth users or test households.**
- **No local Docker/Supabase stack on Ariel's workstation unless Ariel explicitly approves a documented exception.**
- Default live-test target = isolated hosted Supabase branch/project.
- Do not run E2E signup flows against production.
- Do not alter RLS semantics unless a failing M1 acceptance test requires it and the change is separately justified.
- Do not delete existing production Auth users during M1.
- Do not run the historical bootstrap/seed scripts again.
- Do not touch the rollback tag `pilot-ready-2026-07-24`.
- No force-push or history rewrite.
- No broad visual redesign in this branch.

## 7. Acceptance criteria — M1 is DONE only if all are true

1. Two browser contexts can edit the same day without deleting each other's unrelated entries.
2. Add/update/delete converge to the same Supabase state on both contexts.
3. Fasting/workout create and clear propagate in real time.
4. An offline mutation survives reload and syncs exactly once after reconnect.
5. Each physical device can reliably default to Ariel or Elena without changing the shared Auth model.
6. Reload reproduces the authoritative database state.
7. UI sync status never reports `saved` before all queued mutations are durably persisted.
8. The built/published artifact exposes a traceable Git SHA/build identity.
9. Cloud/demo mode is explicit and misleading demo-only persistence copy is removed in cloud mode.
10. Typecheck, lint, unit/component tests, relevant live integration tests, E2E tests, and production build all pass.
11. No production data was modified as part of automated verification.
12. M1's normal development/test path completes without starting Docker on Ariel's workstation. If an exception was required, it is explicitly documented and approved rather than silently treated as a prerequisite.

## 8. Required final report from implementer

Return:

- root cause confirmed/refuted for each section above;
- files changed;
- tests added/changed and exact results;
- whether any migration was created and why;
- whether production runtime configuration is verified or still blocked;
- exact branch HEAD SHA;
- diff summary vs baseline;
- any remaining M1 blocker;
- explicit statement that production data was not modified;
- explicit statement whether any Docker/container runtime was started, where it ran, and why. The expected answer is `No local Docker used`.

If any required acceptance criterion cannot be proven, do not mark M1 complete. State the blocker precisely.

## 9. Stop condition

Do not proceed to the couple-first visual redesign in this task.

When M1 is green, hand control back for review. M2 will redesign the home screen around simultaneous partner visibility and lower-friction logging.
