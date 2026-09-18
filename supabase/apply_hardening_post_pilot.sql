-- ============================================================================
-- POST-PILOT hardening — apply supabase/migrations/20260918180000 to PRODUCTION
-- (project rqgoiuztphkcvbwtbxbj) from the Dashboard SQL Editor / Management
-- API, and record it in the CLI migration ledger. Not an M1 blocker: apply
-- after the M2-7 pilot, or earlier if convenient (behaviour is unchanged).
--
-- Reviewed 2026-09-18 (RUN_2026-09-18_RELIABILITY_HARDENING.md, workstream L):
--   * set_updated_at(): pinned search_path = '' and pg_catalog.now() — same
--     behaviour, closes the advisor finding "function_search_path_mutable";
--   * is_household_member(uuid): EXECUTE revoked from public/anon (anon has no
--     table privilege, so it never evaluates a policy); authenticated and
--     service_role keep it. bootstrap_household() was already restricted.
--   * no DDL on tables, no policy change, no data change. Proven on the real
--     SQL by src/lib/supabase/household-join.pg.test.ts.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated, service_role;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';
    return;
  end if;
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('20260918180000', 'harden_function_search_path',
          array['create or replace function public.set_updated_at() ... set search_path = ''''',
                'revoke execute on function public.is_household_member(uuid) from public, anon;',
                'grant execute on function public.is_household_member(uuid) to authenticated, service_role;'])
  on conflict (version) do nothing;
end;
$$;

commit;

-- Post-check: expected  pinned=true · anon_member_exec=false · auth_member_exec=true
select
  pg_get_functiondef('public.set_updated_at()'::regprocedure) like '%search_path%' as pinned,
  has_function_privilege('anon', 'public.is_household_member(uuid)', 'execute') as anon_member_exec,
  has_function_privilege('authenticated', 'public.is_household_member(uuid)', 'execute') as auth_member_exec;
