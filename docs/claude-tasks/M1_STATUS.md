# M1 — Shared Truth Recovery: implementation status

**Branch:** `recovery/m1-shared-truth`
**Spec:** `M1_SHARED_TRUTH_RECOVERY.md` (authoritative)
**Last updated:** 2026-09-16 (real-backend verification run on the isolated hosted branch)
**Isolated test environment:** Supabase development branch `m1-shared-truth-test` (`uyroeumwmjhrcbkesmgb`), parent `rqgoiuztphkcvbwtbxbj`, no production data.

**M1 status: all acceptance criteria are proven on the isolated real backend, except two that are
release actions outside this branch** — applying the new privileges migration to production (needs
approval) and verifying the _published_ artifact's build identity (needs a Lovable publish). See §3.

## 1. Root causes — confirmed / refuted

| Spec § | Claim                                                             | Result                                                                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1    | `pushDay()` deletes remote entries absent from the local snapshot | **Confirmed** (`shared-truth.test.ts`: the retired snapshot path deletes the partner's entry). Routine path is `applyOperation`; `pushDay` → `pushDaySnapshotUNSAFE`, no callers.                                                          |
| 3.2    | No remote delete for cleared fasting/workout                      | **Confirmed**. Fixed: `fasting.clear` / `workout.clear` → `deleteFasting` / `deleteWorkout`. Proven live (`shared-truth.live.integration.test.ts`, `e2e/shared-truth.spec.ts` Test 4).                                                     |
| 3.3    | Realtime missed `fasting_logs`/`workout_logs`; rehydrated view    | **Confirmed**. Fixed: all 7 mutable tables; `describeChange` maps payload `profile_id`/`log_date`. Live finding: DELETE payloads carry **only `{id}`** (replica identity default) — handled by lookup + fallback.                          |
| 3.4    | Queue not on the active path                                      | **Confirmed**. Fixed: `queue.ts` + `drain.ts` wired into `use-supabase-sync`. Proven hermetically and in the browser against the branch (`e2e/offline.spec.ts`: reload while Supabase unreachable → exactly once).                         |
| 3.5    | Every device starts as Ariel                                      | **Confirmed**. Fixed: per-device preference + one-time chooser.                                                                                                                                                                            |
| 3.6    | No build identity; runtime truth unproven                         | **Confirmed**. Fixed: `VITE_BUILD_SHA`, footer/console/window identity, explicit cloud/demo notice. Published artifact still unverified (no publish).                                                                                      |
| 3.7    | Docker not an app requirement                                     | **Confirmed**. Both runs executed with no container runtime.                                                                                                                                                                               |
| new    | **Migrations do not reproduce a working schema**                  | **Found on the branch**: no migration grants table privileges; a freshly provisioned environment defaults to no SELECT/INSERT/UPDATE/DELETE for API roles → every query fails 42501. Fixed by `20260916120000_grant_table_privileges.sql`. |
| new    | Activation never retried after a transient failure                | **Found by `e2e/offline.spec.ts`**: bootstrap failure at load left the app inactive until an `online` event. Fixed: bounded backoff retry (3/6/12/30 s) + single-flight activation (no duplicate channels).                                |

## 2. Migrations applied to the isolated branch (never to production)

| Migration                                                | Applied where               | Note                                                                                                                                           |
| -------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260723090000` … `20260723090400`                      | already on branch           | Verified schema: RLS on 10 tables, 35 policies, realtime publication (8 tables), `food_preferences.food_id` text.                              |
| `20260725190000_cleanup_mock_data_and_seed_food_catalog` | branch (`db push --db-url`) | Empty branch → cleanup matched 0 rows, catalog seeded 0 rows (no households), 1 index created. Ledger now equals the repository.               |
| `20260916120000_grant_table_privileges` (**new**)        | branch (`db push --db-url`) | GRANT S/I/U/D on public tables to `authenticated`, `service_role` + default privileges. `anon` gets nothing. **Production: pending approval.** |

Post-DDL checks on the branch (SQL, read-only): no RLS-enabled table without a policy, no RLS-disabled
table, no `USING (true)` policy, both SECURITY DEFINER functions pin `search_path=public`, `anon` has 0
data privileges. Performance note (pre-existing, unchanged): FKs `*.household_id` and
`food_entries.food_id` have no covering index. The hosted Security/Performance Advisors could not be
run because the connected Supabase MCP account cannot see this organisation's projects.

`REPLICA IDENTITY FULL` was **deliberately not applied**: DELETE events already arrive under RLS with
the primary key, the client resolves them (in-memory lookup, then current-view fallback), and FULL
would broadcast entire deleted rows to every subscriber of the table — a cross-household exposure risk.

## 3. Acceptance criteria (spec §7)

| #   | Criterion                                            | Status                                                                                                                                                                                                          |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Two contexts edit the same day without cross-deletes | **Proven live** — data layer (`shared-truth.live.integration.test.ts` Test 1) + browser (`e2e/shared-truth.spec.ts` Test 1+2).                                                                                  |
| 2   | Add/update/delete converge on both contexts          | **Proven live** — `e2e/shared-truth.spec.ts`, `e2e/realtime.spec.ts`, `remote-live` realtime test, replay idempotency in the live suite.                                                                        |
| 3   | Fasting/workout create + clear propagate in realtime | **Proven live** — data layer Test 4 (INSERT/DELETE events observed on device B) + browser Test 4.                                                                                                               |
| 4   | Offline mutation survives reload, syncs exactly once | **Proven live** — `e2e/offline.spec.ts` (queue non-empty across reload, empty after reconnect, entry appears once) + hermetic hook test.                                                                        |
| 5   | Each device defaults to Ariel or Elena               | **Proven** — Vitest + hermetic Playwright; browser suites answer the chooser per context.                                                                                                                       |
| 6   | Reload reproduces authoritative DB state             | **Proven live** — `e2e/crud.spec.ts` (refresh, session lifecycle), `e2e/shared-truth.spec.ts` (reload after cross-device delete).                                                                               |
| 7   | Sync UI never says "saved" with queued mutations     | **Proven** — state derived from the durable queue; `e2e/offline.spec.ts` asserts no "saved" while unreachable; `data-realtime` exposes live-channel state.                                                      |
| 8   | Artifact exposes a traceable Git SHA                 | **Proven for local builds** (SHA embedded). **Published artifact: pending** a Lovable publish + read-only check (`docs/RUNTIME_CONFIG.md §4`).                                                                  |
| 9   | Cloud/demo explicit; demo copy removed in cloud mode | **Proven** — component tests + hermetic browser; cloud copy visible in the branch-backed browser runs.                                                                                                          |
| 10  | typecheck, lint, unit, live, E2E, build all pass     | **All pass**: typecheck, lint (0 errors / 8 pre-existing warnings), vitest 254 passed, live suites 15/15 (rls 5, remote-live 7, shared-truth live 3), backend Playwright 12/12, hermetic Playwright 3/3, build. |
| 11  | No production data modified                          | **True** — all writes went to `uyroeumwmjhrcbkesmgb`.                                                                                                                                                           |
| 12  | No Docker on the workstation                         | **True**.                                                                                                                                                                                                       |

## 4. Remaining work (release actions, not code)

1. **Approve + apply `20260916120000_grant_table_privileges.sql` to production** (`rqgoiuztphkcvbwtbxbj`).
   It is idempotent and a no-op for `authenticated`/`service_role` there (they already hold the
   privileges implicitly); it does not revoke anything. Apply via the controlled release path, not from
   a workstation linked to production by accident (the CLI link file currently points at production —
   always pass `--db-url` for the branch).
2. Publish a build containing `RuntimeModeNotice` through the manual Lovable path and perform the
   read-only production verification (`docs/RUNTIME_CONFIG.md §4`).
3. Housekeeping on the disposable branch: the branch DB password was printed into an assistant
   session transcript on 2026-09-16 (branch-only credential, not production). Reset it or delete the
   branch when M1 is closed.
4. Optional: covering indexes for `household_id` FKs (performance advisor class), surfacing
   `lastError` of failed ops in the UI, exponential backoff for the 3 s drain retry.
