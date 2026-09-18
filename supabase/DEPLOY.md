# Deploying to the remote Supabase project

## Access simplification (2026-09-18, DEC-031) — migration APPLIED (controlling GPT, verified); ONE Auth setting still pending

`supabase/migrations/20260918160000_anonymous_device_join.sql` replaces `bootstrap_household()` so
that every device session (Supabase **anonymous** user) joins the one existing household instead of
creating its own. No table DDL, no policy change, no data change, no privilege for `anon`. Proven on
the real SQL by `src/lib/supabase/household-join.pg.test.ts`.

**State 2026-09-18 17:45:** steps 1–3 done and verified externally (1 household, 2 profiles, 390 foods,
device-join function with the advisory lock, ledger `20260918160000`, RLS on 10, anon cannot execute).
Step 4 (the Auth switch) was still OFF at 17:39. Apply path, for the record:

1. Run `supabase/verify_anonymous_join.sql` (read-only); keep the output. §1 must show the July
   household first (seeded catalog, two profiles).
2. Run `supabase/apply_anonymous_join_production.sql` (idempotent; also records `20260918160000` in
   `supabase_migrations.schema_migrations`).
3. Run `supabase/verify_anonymous_join.sql` again: §3 `is_device_join_version = true`,
   `anon_can_execute = false`; §4 lists `20260918160000`; §5 RLS on all 10.
4. **Auth setting:** Authentication → Sign In / Providers → **Allow anonymous sign-ins = ON**
   (Management API: `PATCH /v1/projects/rqgoiuztphkcvbwtbxbj/config/auth` with
   `{"external_anonymous_users_enabled": true}`). Verified disabled on 2026-09-18 15:50
   (`POST /auth/v1/signup {}` → `422 anonymous_provider_disabled`). Leave CAPTCHA off (it would
   break the silent connection); keep the default anonymous sign-in rate limit.

**Still never a plain `supabase db push` against production** (ledger reasons below).

### Post-pilot hardening (2026-09-18) — ONE more migration, NOT a blocker

`supabase/migrations/20260918180000_harden_function_search_path.sql` pins `set_updated_at()` to
`search_path = ''` and revokes EXECUTE on `is_household_member(uuid)` from `public`/`anon`
(advisor findings; behaviour unchanged, proven in PGlite). Apply after the M2-7 pilot with
`supabase/apply_hardening_post_pilot.sql` (records `20260918180000` in the ledger; prints a
post-check). Leaked-password protection (Auth setting) may be switched on at the same time — the
product has no passwords, so it changes nothing for users.

## M1 release (2026-09-18) — applied to production on 2026-09-18 (kept for history)

> Single entrypoint for the whole release (config, publish, this migration, live acceptance):
> `docs/claude-tasks/M1_RELEASE_ACCEPTANCE.md`.

`supabase/migrations/20260916120000_grant_table_privileges.sql` is reviewed (run record
`docs/claude-tasks/RUN_2026-09-18_M1_PROMOTION.md` §2) and applied to the isolated branch
`uyroeumwmjhrcbkesmgb`, but **not yet to production `rqgoiuztphkcvbwtbxbj`**. It only GRANTs
SELECT/INSERT/UPDATE/DELETE to `authenticated`/`service_role` (+ default privileges); nothing is
revoked, `anon` gets nothing, RLS is untouched. On production it is expected to be a no-op.

**Do not run a plain `supabase db push` against production.** Its ledger records migrations only
through `20260723090400`; `20260725190000` was applied by SQL-editor paste (below), so `db push` would
re-run the cleanup/seed migration on real data (DEC-021).

**Runtime configuration (the other half of the release, DEC-025):** the published build
reads the committed `.env.production`. Add `VITE_SUPABASE_ANON_KEY=<anon/publishable key>`
there (GitHub web editor or Lovable code mode), commit to `main`, publish from Lovable, then
`npm run preflight -- --live` must print `PREFLIGHT PASS`. Without the key the published app is
**blocked** (RuntimeGate), not silently demo.

Apply path (Dashboard, owner account, ~2 minutes, no CLI, no DB password):

1. SQL Editor → run `supabase/verify_privileges.sql` (read-only) and keep the output as BEFORE.
2. SQL Editor → run `supabase/apply_m1_grants_production.sql` (idempotent; also records both
   `20260725190000` and `20260916120000` in `supabase_migrations.schema_migrations`).
3. SQL Editor → run `supabase/verify_privileges.sql` again: §2 returns **zero rows**, §7 lists both
   versions, §5 shows RLS enabled on all 10 tables.

CLI alternative from a workstation linked to production (never needs Docker):
`supabase migration repair --status applied 20260725190000` → `supabase db push --dry-run` (must list
only `20260916120000`) → `supabase db push` → `verify_privileges.sql`.

## APPLIED (2026-07-25) — nothing else is pending

The production bootstrap is **complete**. Applied once, manually, in the SQL Editor of project
`rqgoiuztphkcvbwtbxbj`:

- `supabase/bootstrap_and_seed.sql` — created the household, its membership and the two profiles
  (אריאל / אלנה), then seeded the catalog.
- `supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql` — cleanup +
  catalog seed.

Verified final report: 1 household · 2 memberships · 2 profiles · 6 meal slots · RLS on 10 tables ·
**390 active foods** · `weigh_ins = 0` · status **READY**.

**Do not rerun either script** (DEC-021). They are idempotent, but the baseline exists and re-running
is unnecessary operational risk on real data. For any doubt, run `supabase/verify_catalog.sql`, which
is **read-only** and safe to run any number of times.

Future catalog or schema changes go into a **new** forward-only migration; regenerate the seed SQL from
the TypeScript modules with `npm run catalog:seed`.

Note for a fresh project: the catalog seed inserts one row **per household**
(`from public.households h cross join catalog c`), so it seeds nothing until a household exists.
`bootstrap_and_seed.sql` creates that household and is the correct starting point.

---

# Deploying the schema to the remote Supabase project

The migrations under `supabase/migrations/` (schema + RLS + bootstrap + realtime)
are idempotent and were verified against a local Supabase stack (RLS isolation +
bootstrap: 5/5 integration tests). They must be applied to the remote project
`rqgoiuztphkcvbwtbxbj` before the app can use it.

Pick **one** of the following.

## Option A — Dashboard (fastest, no CLI)

1. Open the project's **SQL Editor** in the Supabase Dashboard.
2. Paste the contents of `supabase/deploy_all.sql` and run it.
3. Done — it is safe to re-run.

## Option B — Supabase CLI (from this repo)

The CLI must be logged into the account that **owns** project `rqgoiuztphkcvbwtbxbj`
(the currently logged-in account does not have access):

```bash
supabase login                       # browser login as the owning account
supabase link --project-ref rqgoiuztphkcvbwtbxbj   # prompts for the DB password
supabase db push                     # applies supabase/migrations non-destructively
```

## Re-run after new migrations

New forward-only migrations are added over time (e.g. `20260723090400_food_prefs_text_id.sql`,
which lets built-in catalog foods be favorited/recented). Re-apply with either option above —
`supabase db push` applies only pending migrations, and `deploy_all.sql` is idempotent. Until the
`food_prefs_text_id` migration is on the remote, **custom-food** favorites/recents sync fine, but
**built-in-food** favorites/recents do not (the app keeps them locally and retries).

## After applying (either option)

- Bootstrap is automatic: on first sign-in the app calls the `bootstrap_household()`
  RPC, which creates one household + the two profiles (אריאל / אלנה). Idempotent.
- No manual seeding is needed.

## Verify remotely

```bash
# tables present (expects 10)
curl -s "$VITE_SUPABASE_URL/rest/v1/profiles?select=id&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
# RLS: anon gets [] (denied), never an error about a missing table
```

Never put the `service_role` key in the client or in `.env` (anon key only).
