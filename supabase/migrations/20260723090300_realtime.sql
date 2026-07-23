-- Enable Realtime for the user-facing data tables. Clients subscribe filtered
-- by household/profile/date. Safe to re-run: only adds tables not already in
-- the supabase_realtime publication.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'meal_statuses', 'food_entries', 'fasting_logs', 'workout_logs',
    'weigh_ins', 'food_preferences', 'foods', 'profiles'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', t);
    end if;
  end loop;
end;
$$;
