-- REVIEWED WRAPPER: apply only through the approved production SQL path.
begin;
\ir migrations/20260919053000_daily_points_v1.sql
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20260919053000', array['daily points v1 additive schema'], 'daily_points_v1')
on conflict (version) do nothing;
commit;
