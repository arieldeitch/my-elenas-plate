# M1 release acceptance — the single entrypoint

**Purpose:** once the owner actions are done, decide in minutes whether M1 (shared truth) is
genuinely live in production. Everything below is read-only against production; nothing here
writes production data except the two real-user acceptance entries in §3, made by the couple's
own accounts through the app.

**Status (updated 2026-09-18, ninth run): §1 done · §2 PASS · §3 pending on the phones (§3a).**
Evidence (`RUN_2026-09-18_M1_ACCEPTANCE.md`): `npm run preflight -- --live` → **PREFLIGHT PASS — 14
checks** on the served build of `main` `0cd3673` (deployment `psr2.4acecc14…`, `mode=cloud`,
`target=shared`, `misconfigured=false`, host `rqgoiuztphkcvbwtbxbj.supabase.co`, no secret material);
the sign-in screen is served with no block page and no console errors. Database: the owner applied and
verified the reviewed grants/default privileges and ledger rows directly (10 tables, RLS on all,
`authenticated`/`service_role` privileges, ledger `20260725190000` + `20260916120000`, SECURITY DEFINER
functions pinned); from a session, anonymous REST reads return `[]` on all 10 tables and an anonymous
insert is rejected by RLS. Of §3, **item 9 PASSES**; items 1–8 and 10 need the shared account signed in
on a real device — no Claude session has that (no Chrome extension, MCP accounts belong to another
workspace, production sign-up flows are off-limits) — so they are executed by Ariel and Elena via
**§3a** and M1 is marked CLOSED by the next run from their reply. Security-advisor items (mutable
`search_path` on `set_updated_at`, SECURITY DEFINER exposure, leaked-password protection) are recorded
in `docs/todo.md` for a hardening pass; none blocks M1.

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

### 3a. The same checks on your own phones (Ariel + Elena, ≈10 minutes, once) — closes M1

No Supabase, GitHub or Lovable. Both of you open <https://my-elenas-plate.lovable.app> and sign in
with the shared account. Then, in order:

| #   | Do                                                                                       | OK when                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | On Elena's phone, first open: choose **אלנה** in the device chooser; reload the page     | The today card is Elena's after the reload; the switcher shows אלנה                         |
| 2   | On Ariel's phone (as **אריאל**): log one real food in an empty meal                      | The editor title says the meal · אריאל; the row shows **מסונכרן** afterwards                |
| 3   | On Elena's phone (as **אלנה**): log one real food                                        | Same, with · אלנה; Ariel's day did not change                                               |
| 4   | Look at the partner card on both phones                                                  | Each phone shows the other person's entry for today                                         |
| 5   | Ariel adds one more food; Elena watches her phone **without reloading**                  | Elena's partner card updates within a few seconds                                           |
| 6   | Reload both phones                                                                       | Nothing changed; the footer reads `build 0cd3673 · cloud` (or a newer sha, still `· cloud`) |
| 7   | On a phone that used the old (demo) app: after signing in                                | None of the old demo entries appear; today shows only what you logged now                   |
| 8   | On Ariel's phone, switch to **אלנה** and change the quantity of Elena's entry with − / + | Only Elena's row changed, on both phones                                                    |
| 10  | Normal use: tile → result → סיום; a chip; skip a meal; log fasting; log a workout        | Each shows **מסונכרן** afterwards, never stuck on ממתין לסנכרון / הסנכרון נכשל              |

(Item 9, authorization, is already PASS from the session — nothing to do.) Then reply, in the next
run's prompt or a note: **"§3a all OK"**, or the numbers that were not OK and what you saw. That reply
is the evidence that closes M1; the entries you logged are real meals, keep them.

## 4. Verdict

M1 is **live** only when §2 is `PREFLIGHT PASS`, the DB check passes, and §3 has ten `PASS` (§3a
replies count as the `PASS` for items 1–8 and 10). §2 + DB + item 9: done 2026-09-18
(`RUN_2026-09-18_M1_ACCEPTANCE.md`). The next run records the §3a reply there, then marks M1 CLOSED in
`M1_STATUS.md`, `docs/todo.md`, `docs/project-status.md`, `docs/claude-context.md`.

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
