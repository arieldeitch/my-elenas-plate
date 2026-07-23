-- First-login bootstrap for the shared household account.
-- Idempotent RPC: returns the existing household if the user already has one,
-- otherwise atomically creates the household, membership and the two profiles.

create or replace function public.bootstrap_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? return that household (idempotent, no duplicates).
  select hu.household_id into hid
  from public.household_users hu
  where hu.user_id = auth.uid()
  limit 1;

  if hid is not null then
    return hid;
  end if;

  insert into public.households (name)
  values ('משק בית')
  returning id into hid;

  insert into public.household_users (household_id, user_id, role)
  values (hid, auth.uid(), 'owner')
  on conflict (household_id, user_id) do nothing;

  insert into public.profiles (household_id, display_name, slug, sort_order)
  values
    (hid, 'אריאל', 'ariel', 1),
    (hid, 'אלנה', 'alena', 2)
  on conflict (household_id, slug) do nothing;

  return hid;
end;
$$;

-- Function execute grants (policies + RPC).
grant execute on function public.is_household_member(uuid) to authenticated, anon;
grant execute on function public.bootstrap_household() to authenticated;
