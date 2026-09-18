# M1 release acceptance — the single entrypoint

**Purpose:** once the owner actions are done, decide in minutes whether M1 (shared truth) is
genuinely live in production. Everything below is read-only against production; nothing here
writes production data except the two real-user acceptance entries in §3, made by the couple's
own accounts through the app.

**Status (updated 2026-09-18): owner actions A, B and C completed externally; live acceptance still pending.**
Evidence: `.env.production` on `main` now contains the production Supabase publishable key in commit
`2651c0c1e7d298ce8442e50b68343210bb97b945` (A complete). Lovable has synced that same commit and a
new production publish was triggered (B complete; live preflight still required to prove the served bundle).
Supabase production now has the reviewed M1 grants/default privileges applied and verified. All 10 expected public tables have RLS enabled; `authenticated` and `service_role` have the required table privileges; the migration ledger now contains both `20260725190000` and `20260916120000`; the two existing SECURITY DEFINER functions remain pinned to `search_path=public`. Action C is complete. Live preflight and the ten live checks are still required before M1 can close.
When §1–§3 pass, record the evidence in a `RUN_<date>_M1_ACCEPTANCE.md`, `M1_STATUS.md` §4 and close
M1 in `docs/todo.md`.

Direct links for the owner actions (all three are inside Ariel's own accounts):

- A — edit the file on GitHub: <https://github.com/arieldeitch/my-elenas-plate/edit/main/.env.production>
- B — the Lovable project: <https://lovable.dev/projects/ca9aedab-a0ca-4889-a545-9d673febf3a0> → Publish / Update
- C — the SQL editor: <https://supabase.com/dashboard/project/rqgoiuztphkcvbwtbxbj/sql/new>

## 1. Owner actions (Ariel — the only steps a Claude session cannot do)

| #   | Where                                                    | Action                                                                                                                                                                                                | Done? |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A   | GitHub web editor or Lovable code mode                   | In `.env.production`, replace the commented last line with `VITE_SUPABASE_ANON_KEY=<anon/publishable key>` (Supabase → Project Settings → API Keys; never `service_role`). Commit to `main`.          | ☑     |
| B   | Lovable → project → **Publish / Update**                 | Publish `main`. Until A is done the published app shows the block page (by design, DEC-025).                                                                                                          | ☑     |
| C   | Supabase Dashboard → `rqgoiuztphkcvbwtbxbj` → SQL Editor | Run `supabase/verify_privileges.sql` (keep output), then `supabase/apply_m1_grants_production.sql`, then `verify_privileges.sql` again. Paste the second output into the next Claude run (or a Gist). | ☑     |

## 2. Automated verification (Claude, ~2 minutes, read-only)

```sh
git fetch origin && git checkout main && git pull --ff-only
npm run preflight -- --live          # must end with: PREFLIGHT PASS
```

`PREFLIGHT PASS` means, with evidence printed per line: the site serves HTTP 200, `/build-info.json`
exists, `sha` = `origin/main`, `mode=cloud`, `target=shared`, `misconfigured=false`, compiled against
`rqgoiuztphkcvbwtbxbj.supabase.co`, the bundle contains that host, no secret-shaped strings, the
project answers on `/rest/v1/`. Any `FAIL` line names exactly what the owner still has to fix.

Database (from the pasted `verify_privileges.sql` output — or `execute_sql` if a future session has
access): §2 returns **zero rows**, §5 shows `rls_enabled=true` for all 10 tables, §7 lists
`20260725190000` and `20260916120000`. Anything else → grants not applied → stop, report.

## 3. Live acceptance (needs an authenticated browser session — Chrome extension or Playwright with a real login; never the automated e2e sign-up flows)

Use the shared household account. The UI test ids below exist on `main` since M2.

| #   | Check                             | How                                                                           | Pass when                                                                                  |
| --- | --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Person selection                  | Fresh browser profile → the device chooser appears; choose אלנה               | `today-card[data-owner=elena]`, switcher tab אלנה selected, reload keeps it                |
| 2   | Ariel-side attribution            | Switch to אריאל, log one real food in an empty slot                           | Editor labelled `<slot> · אריאל`; Supabase `food_entries` row has Ariel's `profile_id`     |
| 3   | Elena-side attribution            | Switch to אלנה (partner card), log one real food                              | Same, with Elena's `profile_id`; Ariel's day unchanged                                     |
| 4   | Shared visibility                 | Second browser/phone signed in as the same account                            | Both entries visible on both devices' partner/today cards for the same date                |
| 5   | Cross-side propagation            | Add on device A, watch device B without reload                                | B updates within seconds (`data-realtime=subscribed`)                                      |
| 6   | Reload does not revert            | Reload both devices                                                           | Same state; footer `build <sha> · cloud`                                                   |
| 7   | Local stale state never overrides | On a device that still holds pre-cloud localStorage data, sign in             | Store hydrates from the cloud only; no old local entries appear; nothing written from them |
| 8   | Editing hits the right person     | Edit the quantity of Elena's entry from Ariel's device (switch to אלנה first) | Only Elena's row changes                                                                   |
| 9   | Authorization                     | Anonymous `curl` to `/rest/v1/food_entries` with the anon key                 | Empty result / 401 — RLS enforced (same as the 2026-08-01 probes)                          |
| 10  | Daily-use path                    | Tile → result → confirm; chip quick-add; skip a meal; fasting; workout        | Each shows `מסונכרן` afterwards (never while anything is pending)                          |

Delete the two acceptance entries afterwards if they are not real meals, from the app (so the
deletes propagate), and note it.

## 4. Verdict

M1 is **live** only when §2 is `PREFLIGHT PASS`, the DB check passes, and §3 has ten `PASS`.
Record the run in a `RUN_<date>_M1_ACCEPTANCE.md` next to this file with the preflight output, the
SQL output and the ten results; update `M1_STATUS.md`, `docs/todo.md`, `docs/claude-context.md`.

## 5. Legacy phone data — verified behaviour (2026-09-18, hermetic proof)

`src/lib/sync/cloud-path.test.tsx` "legacy phone data (M1-R5 safety)": with a realistic pre-cloud
`elenas-plate:v1` snapshot in localStorage, the cloud build starts from Supabase only (the legacy
apple / weigh-in / favourite do not appear), pushes nothing derived from it, leaves the snapshot
byte-for-byte intact, sets the `elenas-plate:migrated:*` markers so the retired importer can never
auto-fire, and new logging writes to the cloud only. Live check §3 item 7 confirms the same on a real
phone; M1-R5 (import or discard) stays a separate decision.


### Production DB evidence — 2026-09-18

Applied through the connected Supabase production project `rqgoiuztphkcvbwtbxbj` using the already-reviewed M1 statements from `supabase/apply_m1_grants_production.sql`.

Verified afterwards:

- 10/10 public tables have RLS enabled.
- `authenticated` has SELECT/INSERT/UPDATE/DELETE on all 10 tables (plus existing Supabase default privileges).
- `service_role` has the corresponding table privileges.
- postgres default table privileges include authenticated + service_role.
- migration ledger now lists `20260725190000 cleanup_mock_data_and_seed_food_catalog` and `20260916120000 grant_table_privileges`.
- `bootstrap_household` and `is_household_member` remain SECURITY DEFINER with `search_path=public`.
- Supabase advisors were run after the change. Existing warnings were recorded for later hardening; no new M1-blocking issue was introduced by the grants/ledger change.

This closes owner action C only. M1 still requires §2 live preflight and §3 live acceptance before being marked CLOSED.
