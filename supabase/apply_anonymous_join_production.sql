-- ============================================================================
-- Access simplification (DEC-031) — apply the reviewed device-join migration to
-- PRODUCTION (project rqgoiuztphkcvbwtbxbj) from the Dashboard SQL Editor or
-- the Management API, and record it in the CLI migration ledger.
--
-- Reviewed 2026-09-18 (docs/claude-tasks/RUN_2026-09-18_ACCESS_SIMPLIFICATION.md):
--   * replaces ONE function, public.bootstrap_household(): a new auth user now
--     JOINS the existing (oldest) household instead of creating a new one;
--     the household + two profiles are created only when none exists;
--   * execute revoked from public/anon, kept for authenticated (anonymous
--     Supabase sessions are `authenticated`);
--   * no DDL on tables, no policy change, no privilege change for anon, no
--     data change. Proven on the real migration SQL by
--     src/lib/supabase/household-join.pg.test.ts (in-process Postgres).
--
-- HOW TO USE
--   1. Run supabase/verify_anonymous_join.sql first (read-only) and keep the output.
--   2. Run THIS whole file. Safe to re-run: every statement is idempotent.
--   3. Run supabase/verify_anonymous_join.sql again: §1 = 1 household (or the
--      oldest one listed first with the seeded catalog), §3 shows the function
--      body contains 'pg_advisory_xact_lock', §4 lists 20260918160000.
--   4. Dashboard → Authentication → Sign In / Providers → enable
--      "Allow anonymous sign-ins" (or Management API:
--      PATCH /v1/projects/rqgoiuztphkcvbwtbxbj/config/auth
--      {"external_anonymous_users_enabled": true}). Without it the app shows
--      "לא הצלחנו להתחבר כרגע." on every fresh device.
-- ============================================================================

begin;

-- ---- body of supabase/migrations/20260918160000_anonymous_device_join.sql ---
create or replace function public.bootstrap_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? Return that household (idempotent: repeat opens create nothing).
  select hu.household_id into hid
  from public.household_users hu
  where hu.user_id = auth.uid()
  order by hu.created_at
  limit 1;

  if hid is not null then
    return hid;
  end if;

  -- Serialise first-time joins so two fresh devices opening the app at the
  -- same moment can never race into two households.
  perform pg_advisory_xact_lock(hashtext('elenas-plate:bootstrap_household'));

  -- The one shared household of this app is the oldest one (the July 2026
  -- bootstrap that also holds the seeded food catalog).
  select h.id into hid
  from public.households h
  order by h.created_at, h.id
  limit 1;

  if hid is null then
    insert into public.households (name)
    values ('משק בית')
    returning id into hid;
    created := true;
  end if;

  -- Membership for this auth user (device session or the shared account).
  insert into public.household_users (household_id, user_id, role)
  values (hid, auth.uid(), case when created then 'owner' else 'member' end)
  on conflict (household_id, user_id) do nothing;

  -- Exactly two product profiles, never duplicated (unique (household_id, slug)).
  insert into public.profiles (household_id, display_name, slug, sort_order)
  values
    (hid, 'אריאל', 'ariel', 1),
    (hid, 'אלנה', 'alena', 2)
  on conflict (household_id, slug) do nothing;

  return hid;
end;
$$;

revoke execute on function public.bootstrap_household() from public, anon;
grant execute on function public.bootstrap_household() to authenticated;
-- ---------------------------------------------------------------------------

-- Ledger: mark the repository migration as applied (no SQL is re-executed).
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';
    return;
  end if;

  insert into supabase_migrations.schema_migrations (version, name, statements)
  values
    ('20260918160000', 'anonymous_device_join',
     array['create or replace function public.bootstrap_household() ... (device join, DEC-031; applied via SQL editor / Management API on 2026-09-18)',
           'revoke execute on function public.bootstrap_household() from public, anon;',
           'grant execute on function public.bootstrap_household() to authenticated;'])
  on conflict (version) do nothing;
end;
$$;

commit;

-- Quick post-check: the function is the DEC-031 version and only authenticated may run it.
select
  position('pg_advisory_xact_lock' in pg_get_functiondef('public.bootstrap_household()'::regprocedure)) > 0
    as is_device_join_version,
  has_function_privilege('authenticated', 'public.bootstrap_household()', 'execute') as authenticated_can_execute,
  has_function_privilege('anon', 'public.bootstrap_household()', 'execute') as anon_can_execute;
