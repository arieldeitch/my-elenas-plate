# Deploying to the remote Supabase project

## PENDING (2026-07-25): one action required before real logging starts

`20260725190000_cleanup_mock_data_and_seed_food_catalog.sql` is written, tested and
committed, but **not applied** — the Supabase CLI account logged in on this machine
does not own project `rqgoiuztphkcvbwtbxbj` (`supabase migration list` → HTTP 403),
there is no `SUPABASE_DB_PASSWORD`, and no local stack is available. It therefore
has to be applied by hand, once:

1. Open project **`rqgoiuztphkcvbwtbxbj`** in the Supabase Dashboard.
2. Open **SQL Editor** → new query.
3. Paste the whole of
   `supabase/migrations/20260725190000_cleanup_mock_data_and_seed_food_catalog.sql`.
4. **Run it once.** It finishes by returning a before/after audit table
   (counts only — no food names, weights or dates).
5. Copy that table back into the chat so the result can be reviewed.

Optionally paste `supabase/verify_catalog.sql` afterwards for a read-only re-check
(it writes nothing and can be run any number of times).

What it does: deletes rows created by the automated test suites and by the removed
localStorage demo seed, identified by explicit fingerprints — never by date — then
upserts the 390-item Hebrew catalog into `public.foods` for every household. It
never touches `auth.users`, profiles, memberships, RLS or policies, never
`TRUNCATE`s, and has no unconditional `DELETE`. Re-running is safe: the cleanup
matches nothing the second time and the seed upserts in place.

Until it is applied the app still works — the bundled catalog is the fallback — but
the database catalog stays empty and any mock rows remain.

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
