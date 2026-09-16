# M1 — Shared Truth Recovery: implementation status

**Branch:** `recovery/m1-shared-truth`
**Spec:** `M1_SHARED_TRUTH_RECOVERY.md` (authoritative)
**Last updated:** 2026-09-16 (autonomous implementation run)
**M1 is NOT complete.** The hermetic slice is implemented and green; the real-backend gate is pending.

## Root causes — confirmed / refuted

| Spec § | Claim                                                             | Result                                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1    | `pushDay()` deletes remote entries absent from the local snapshot | **Confirmed** by `src/lib/sync/shared-truth.test.ts` ("B's stale snapshot deletes A's X"). Routine path replaced by `applyOperation`; `pushDay` renamed `pushDaySnapshotUNSAFE`, no callers.               |
| 3.2    | No remote delete for cleared fasting/workout                      | **Confirmed** (old `pushDay` only upserted when present). Fixed: `fasting.clear` / `workout.clear` ops → `deleteFasting` / `deleteWorkout`.                                                                |
| 3.3    | Realtime missed `fasting_logs` / `workout_logs`; rehydrated view  | **Confirmed**. Fixed: `REALTIME_TABLES` includes both; `describeChange` maps payload `profile_id`/`log_date` → affected day; DELETE-without-metadata locates the row in memory before falling back.        |
| 3.4    | Queue not on the active path; dirty sets in memory only           | **Confirmed**. Fixed: `queue.ts` (localStorage, operations only, coalescing, owner-stamped) + `drain.ts` wired into `use-supabase-sync`. Hermetic Test 5 proves offline → reload → reconnect exactly once. |
| 3.5    | Every device starts as Ariel                                      | **Confirmed**. Fixed: per-device preference + one-time chooser; shared account untouched.                                                                                                                  |
| 3.6    | No build identity in the artifact; runtime truth unproven         | **Confirmed**. Fixed: `VITE_BUILD_SHA` injection, footer/console/window identity, explicit cloud/demo notice. Production verification still **pending** (nothing published).                               |
| 3.7    | Docker not an app requirement                                     | **Confirmed**. Entire run executed without any container runtime.                                                                                                                                          |

## Acceptance criteria (spec §7)

| #   | Criterion                                            | Status                                                                                                                                                                                    |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Two contexts edit the same day without cross-deletes | **Proven hermetically** (shared-truth Tests 1–2 against the fake transport, real mappers/repositories). **Pending** on hosted branch (`e2e/shared-truth.spec.ts`).                        |
| 2   | Add/update/delete converge on both contexts          | Hermetic: converge after drain + realtime (`cloud-path.test.tsx`). **Pending** real Realtime.                                                                                             |
| 3   | Fasting/workout create + clear propagate in realtime | Hermetic: executor clear paths + realtime targeting (`shared-truth`, `cloud-path`). **Pending** real Realtime (`e2e/shared-truth.spec.ts` Test 4).                                        |
| 4   | Offline mutation survives reload, syncs exactly once | **Proven hermetically** (`cloud-path.test.tsx` Test 5). **Pending** real browser + hosted branch (`e2e/offline.spec.ts`).                                                                 |
| 5   | Each device defaults to Ariel or Elena               | **Proven** (Vitest store/component tests + hermetic Playwright `e2e/hermetic/device-profile.spec.ts`).                                                                                    |
| 6   | Reload reproduces authoritative DB state             | Hermetic (fresh provider hydrates only from the fake). **Pending** hosted.                                                                                                                |
| 7   | Sync UI never says "saved" with queued mutations     | **Proven hermetically**: state derived from the queue; demo pulse disabled in cloud mode; failed ops visible with retry/discard.                                                          |
| 8   | Artifact exposes a traceable Git SHA                 | **Proven for local build** (`66b0805` / `2624a52` embedded). Published artifact: **pending** (no publish in this run).                                                                    |
| 9   | Cloud/demo explicit; demo copy removed in cloud mode | **Proven** (`RuntimeModeNotice.test.tsx`, `build-info.test.ts`, hermetic Playwright `runtime-mode.spec.ts`).                                                                              |
| 10  | typecheck, lint, unit, live, E2E, build all pass     | typecheck ✅ lint ✅ (0 errors, 8 pre-existing warnings) vitest ✅ (252 passed, 12 skipped live suites) hermetic Playwright ✅ (3) build ✅. Live integration + backend E2E: **pending**. |
| 11  | No production data modified                          | **True** — no write to any Supabase project in this run.                                                                                                                                  |
| 12  | No Docker on the workstation                         | **True** — no container runtime started.                                                                                                                                                  |

## What remains (next run)

1. **Provision the isolated hosted Supabase development branch** (owner/cost
   approval required — not done by Claude). Then create `.env.e2e` and
   `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` for that branch only.
2. Run on the branch: `rls.integration.test.ts`, `remote-live.integration.test.ts`,
   `npm run e2e` (crud, offline, realtime, smoke, **shared-truth**). Fix anything
   the real Realtime/RLS semantics reveal (notably DELETE payload shape under RLS).
3. Consider `REPLICA IDENTITY FULL` on `food_entries` / `fasting_logs` /
   `workout_logs` so DELETE events carry `profile_id`/`log_date` (explicit SQL
   migration → approval brief → validate on the branch). Not required for
   correctness thanks to the in-memory lookup + fallback, but it removes a
   full-view refresh on partner deletes.
4. Publish a build containing `RuntimeModeNotice` through the manual Lovable path
   and perform the read-only production verification in
   `docs/RUNTIME_CONFIG.md §4`. If the footer shows `demo` / the red alert, the
   missing runtime configuration is the blocker to report.
5. Optional hardening: surface `lastError` text of failed ops in the UI;
   exponential backoff for the 3 s retry interval while the server is
   unreachable (currently a fixed, bounded interval; network failures do not
   consume the retry budget by design).
