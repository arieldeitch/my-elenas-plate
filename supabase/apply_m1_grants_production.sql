-- ============================================================================
-- M1 release — apply the reviewed grants migration to PRODUCTION
-- (project rqgoiuztphkcvbwtbxbj) from the Dashboard SQL Editor, and record it
-- in the CLI migration ledger so `supabase db push` never re-runs anything.
--
-- Reviewed 2026-09-18 (docs/claude-tasks/RUN_2026-09-18_M1_PROMOTION.md §2):
--   * idempotent GRANT / ALTER DEFAULT PRIVILEGES only — no REVOKE, no DDL on
--     tables, no policy change, no data change;
--   * anon receives nothing; RLS stays the authorisation gate;
--   * no sequences exist (uuid keys), so no sequence grants are needed;
--   * expected to be a no-op for authenticated/service_role on production.
--
-- HOW TO USE
--   1. Run supabase/verify_privileges.sql first and keep the output (BEFORE).
--   2. Paste THIS whole file into the SQL Editor of rqgoiuztphkcvbwtbxbj and run.
--   3. Run supabase/verify_privileges.sql again (AFTER): §2 must return zero
--      rows, §7 must list 20260725190000 and 20260916120000.
--   Safe to re-run: every statement is idempotent.
--
-- WHY THE LEDGER ROWS
--   Production received 20260725190000 by SQL-editor paste on 2026-07-25
--   (supabase/DEPLOY.md), so the CLI ledger does not know it. A plain
--   `supabase db push` would therefore re-run the cleanup/seed migration on
--   real data (forbidden by DEC-021). Recording both versions makes the ledger
--   equal to the repository. This is what `supabase migration repair
--   --status applied` does, without needing the CLI or the DB password.
-- ============================================================================

begin;

-- ---- body of supabase/migrations/20260916120000_grant_table_privileges.sql --
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
-- ---------------------------------------------------------------------------

-- Ledger: mark both repository migrations as applied (no SQL is re-executed).
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'supabase_migrations.schema_migrations not found — ledger not updated';
    return;
  end if;

  insert into supabase_migrations.schema_migrations (version, name, statements)
  values
    ('20260725190000', 'cleanup_mock_data_and_seed_food_catalog',
     array['-- applied manually via SQL Editor on 2026-07-25 (supabase/DEPLOY.md); ledger row added 2026-09-18']),
    ('20260916120000', 'grant_table_privileges',
     array['grant usage on schema public to authenticated, service_role;',
           'grant select, insert, update, delete on all tables in schema public to authenticated, service_role;',
           'alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to authenticated, service_role;'])
  on conflict (version) do nothing;
end;
$$;

commit;

-- Quick post-check (same as verify_privileges.sql §2 — expected: zero rows).
select t.tablename
from pg_tables t
where t.schemaname = 'public'
  and exists (
    select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
    except
    select privilege_type from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = t.tablename
      and g.grantee = 'authenticated');
