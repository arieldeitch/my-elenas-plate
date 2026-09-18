-- Access simplification (DEC-031): every device connects with a silent Supabase
-- ANONYMOUS session and joins the ONE shared household of this app. There is no
-- login form any more; the product identity (אריאל / אלנה) is chosen per device.
--
-- What changes: bootstrap_household() no longer creates a household per auth
-- user. A new auth user (an anonymous device session, or the historical shared
-- account) becomes a member of the existing household; the household and its
-- two profiles are created only if none exists yet (first device ever).
--
-- What does NOT change: RLS on all 10 tables, is_household_member() as the data
-- boundary, no privilege for the unauthenticated `anon` role (anonymous Auth
-- users run as `authenticated` with a real JWT). No data is touched.
--
-- Idempotent and safe to re-run. Reviewed in RUN_2026-09-18_ACCESS_SIMPLIFICATION.md.

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

-- Only real sessions may join. Anonymous Auth sessions carry the `authenticated`
-- role; the unauthenticated `anon` role stays without execute.
revoke execute on function public.bootstrap_household() from public, anon;
grant execute on function public.bootstrap_household() to authenticated;
