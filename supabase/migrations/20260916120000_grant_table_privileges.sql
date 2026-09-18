-- ============================================================================
-- Explicit table privileges for the Supabase API roles.  Forward-only.
--
-- WHY (found by the M1 reproducibility check on the isolated branch
-- m1-shared-truth-test / uyroeumwmjhrcbkesmgb, 2026-09-16)
--   The repository migrations create the tables and RLS policies but never
--   GRANT table privileges: they silently relied on the platform's default
--   privileges for tables owned by `postgres`.  Production
--   (rqgoiuztphkcvbwtbxbj) was provisioned when that default was
--   `arwdDxtm` for anon/authenticated/service_role, so it works.  A freshly
--   provisioned environment now defaults to `Dxtm` only (no SELECT / INSERT /
--   UPDATE / DELETE), so every authenticated query fails with SQLSTATE 42501
--   "permission denied for table …" before RLS is even evaluated.  The
--   migrations therefore did not reproduce the working schema.
--
-- WHAT
--   * GRANT SELECT/INSERT/UPDATE/DELETE on every existing public table to
--     `authenticated` and `service_role`.
--   * Set the same as default privileges for tables `postgres` creates later,
--     so future migrations do not regress.
--   * `anon` deliberately receives NO data privileges: the app never reads or
--     writes application tables without a session (AuthGate gates the whole
--     UI), and the RLS policies require an authenticated household member
--     anyway.  This is stricter than production's current implicit state and
--     is intentional (least privilege).
--
-- WHAT THIS DOES NOT DO
--   * No RLS policy is created, altered, dropped or disabled — RLS remains the
--     authorisation gate; GRANT is the lower-level prerequisite for it to be
--     evaluated at all.
--   * No change to auth.*, to the shared-account model, or to any data.
--
-- IDEMPOTENCY / PRODUCTION
--   GRANT and ALTER DEFAULT PRIVILEGES are idempotent.  On production this is
--   a no-op for authenticated/service_role (privileges already present) and
--   does not revoke anything from anon.  Rollback: the matching REVOKE
--   statements (see bottom, commented) — never needed on production.
-- ============================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- Rollback (manual, not part of this migration):
--   revoke select, insert, update, delete on all tables in schema public
--     from authenticated, service_role;
--   alter default privileges for role postgres in schema public
--     revoke select, insert, update, delete on tables from authenticated, service_role;
