# Task prompt — run of 2026-09-18 (ninth run, M1 live acceptance) — verbatim as received; list markers may be normalized by prettier

Continue the Nutrition App from the current repository state.

IMPORTANT: the previous owner blockers are resolved externally.

Fetch latest main first.

Expected current main:
0cd367329a1d05abba78948b5ac83cd87ace7554

CURRENT VERIFIED EXTERNAL STATE

A — COMPLETE
Production Supabase public runtime configuration is committed to main.

B — COMPLETE
Lovable has synced the exact same latest Git SHA and a production publish was triggered.
Lovable currently reports the project ready + published.

C — COMPLETE
The reviewed M1 production grants/default-privileges/ledger work was executed directly
against Supabase project:

rqgoiuztphkcvbwtbxbj

Verified production DB state:

- all 10 expected public tables exist;
- RLS is enabled on all 10;
- authenticated has the required SELECT / INSERT / UPDATE / DELETE privileges on all 10;
- service_role has the corresponding table privileges;
- postgres default table privileges include authenticated + service_role;
- migration ledger now contains:
  - 20260725190000 cleanup_mock_data_and_seed_food_catalog
  - 20260916120000 grant_table_privileges
- bootstrap_household and is_household_member remain SECURITY DEFINER with pinned search_path=public;
- an explicit anonymous-role probe against all 10 public tables returned 0 visible rows.

The canonical repo docs were updated accordingly:
docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md
docs/claude-context.md
docs/project-status.md
docs/todo.md

DO NOT ask Ariel to perform any Supabase, GitHub key, or Lovable publish actions.
Those actions are complete.

DO NOT develop new features.

YOUR JOB NOW

Run docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md from the latest main.

1. Run the live preflight.
2. Verify the actually served production deployment:
   - /build-info.json exists;
   - deployed SHA corresponds to current main;
   - runtime target = shared;
   - mode = cloud;
   - misconfigured = false;
   - correct Supabase project host;
   - no service_role/secret key bundled.
3. Use the verified production DB evidence above and perform any additional read-only checks needed.
4. Execute the ten M1 live acceptance checks as far as the available authenticated browser allows.
5. Do not replace live acceptance with hermetic tests.
6. If any check cannot genuinely be executed, mark NOT TESTABLE rather than PASS.
7. If the critical checks all pass:
   - mark M1 CLOSED;
   - update canonical docs;
   - set current milestone to M2-7 REAL DEVICE PILOT;
   - do not implement M2-8.
8. If a production defect is found:
   - fix only the blocking release defect;
   - test it;
   - push;
   - republish through the established path;
   - re-run acceptance.
9. Do not resume speculative product development.

M2-7 RULE

After M1 closes, Ariel and Elena should use the app normally on their own phones for three days.

Do not manufacture new features during this period.

M2-8 will be selected only from the real-device friction log.

Also note for later hardening, NOT as an M1 blocker:
Supabase security advisors currently flag existing items including:

- set_updated_at mutable search_path;
- SECURITY DEFINER function execution exposure;
- leaked-password protection disabled.

Do not broaden this acceptance run into an unrelated security refactor.
Record these for a dedicated hardening pass unless a finding proves to block safe M1 use.

Finish with:

## STATUS

## LIVE BUILD

## DATABASE

## M1 ACCEPTANCE

## TWO-PERSON FLOW

## DAILY LOOP

## M1 VERDICT

## PILOT

## TESTS

## GIT

## DOCUMENTATION

## YOU

## NEXT

## RUN TIMESTAMP

If M1 closes, NEXT must be:
M2-7 real-device pilot. No M2-8 implementation.
