-- Security hardening (post-pilot candidate, reviewed 2026-09-18; not an M1 blocker).
-- Supabase advisor "function_search_path_mutable": public.set_updated_at() had
-- no pinned search_path. A trigger function without one resolves unqualified
-- names through the caller's search_path; pinning it to '' makes every
-- reference explicit (pg_catalog is always searched). Behaviour is unchanged:
-- updated_at is still bumped on every UPDATE of the tables that carry it.
--
-- Also: the unauthenticated `anon` role never evaluates a policy (it holds no
-- table privilege at all since 20260916120000), so it does not need EXECUTE on
-- the membership helper. `authenticated` keeps it (policies run as the caller).
--
-- Idempotent and safe to re-run. Proven on the real SQL in
-- src/lib/supabase/household-join.pg.test.ts. Apply to production only through
-- supabase/DEPLOY.md (SQL editor / Management API), never a plain `db push`.

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
