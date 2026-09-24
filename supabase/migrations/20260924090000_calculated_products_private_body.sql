-- ============================================================================
-- Calculated products + private body progress (DEC-038, 2026-09-24).
-- Additive and forward-only. Idempotent. No existing row is rewritten or deleted.
-- Rollback notes are at the bottom. NOT applied to production by this run.
--
-- WHY (docs/claude-tasks/RUN_2026-09-24_CALCULATED_PRODUCTS_PRIVATE_BODY_REFERENCE_UNITS.md)
--   A. calculated_products: a household product whose TOTAL points were worked
--      out outside the app (for example 52 points for 2000 g of chicken soup).
--      It is its own derived source. It never writes into food_reference_*,
--      and it is not a label estimate. points_per_gram is kept at full precision.
--      A logged serving records the product id, the revision and the exact basis
--      used (food_entries.basis_snapshot), so a later edit cannot change history.
--   B. Private body progress. The household uses ONE shared Auth account for two
--      internal profiles, so profile_id alone is not privacy. The
--      authenticated role therefore loses ALL direct access to weigh_ins, and
--      weigh_ins leaves the realtime publication. Reads and writes go only
--      through SECURITY DEFINER functions that check household membership AND
--      a per-profile PIN (salted bcrypt through pgcrypto crypt(); the raw PIN
--      is never stored). Existing weigh_ins rows are kept exactly as they are.
--   C. food_entries.basis_snapshot records unit-conversion provenance (explicit
--      source equivalence / stored bridge / estimate from the reference).
-- ============================================================================

create extension if not exists pgcrypto;

-- A. calculated products -------------------------------------------------------
create table if not exists public.calculated_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  revision integer not null default 1 check (revision >= 1),
  -- Exactly what the person entered: total points and total prepared weight.
  total_points numeric not null check (total_points >= 0),
  total_weight_g numeric not null check (total_weight_g > 0),
  points_per_gram numeric not null check (points_per_gram >= 0),
  method_version text not null default 'external-calc-v1',
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Only one ACTIVE product may hold a name. An archived one keeps its row (and
-- its history) and does not block naming the replacement the same thing.
create unique index if not exists calculated_products_active_name_idx
  on public.calculated_products (household_id, normalized_name) where is_active;
create index if not exists calculated_products_household_idx
  on public.calculated_products (household_id) where is_active;

alter table public.food_entries add column if not exists calculated_product_id uuid
  references public.calculated_products (id) on delete set null;
alter table public.food_entries add column if not exists calculated_revision integer
  check (calculated_revision is null or calculated_revision >= 1);
-- Write-once provenance of how the snapshot was computed (calculated basis,
-- unit conversion kind + grams per unit). Never read back to re-score history.
alter table public.food_entries add column if not exists basis_snapshot jsonb;

drop trigger if exists set_updated_at on public.calculated_products;
create trigger set_updated_at before update on public.calculated_products
  for each row execute function public.set_updated_at();

revoke all on table public.calculated_products from anon;
revoke all on table public.calculated_products from authenticated;
revoke all on table public.calculated_products from service_role;
grant select, insert, update, delete on table public.calculated_products to authenticated, service_role;
alter table public.calculated_products enable row level security;

drop policy if exists calculated_products_select on public.calculated_products;
create policy calculated_products_select on public.calculated_products
  for select to authenticated using (public.is_household_member(household_id));
drop policy if exists calculated_products_insert on public.calculated_products;
create policy calculated_products_insert on public.calculated_products
  for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists calculated_products_update on public.calculated_products;
create policy calculated_products_update on public.calculated_products
  for update to authenticated using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
drop policy if exists calculated_products_delete on public.calculated_products;
create policy calculated_products_delete on public.calculated_products
  for delete to authenticated using (public.is_household_member(household_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'calculated_products'
     ) then
    alter publication supabase_realtime add table public.calculated_products;
  end if;
end;
$$;

-- B. private body progress -----------------------------------------------------
create table if not exists public.body_privacy (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  -- The unlock capability. Only body_unlock writes it, and every data RPC
  -- requires it to be live; see body_require_pin for why the throttle needs it.
  unlocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Idempotent for a database that already has the pre-capability table.
alter table public.body_privacy add column if not exists unlocked_until timestamptz;

drop trigger if exists set_updated_at on public.body_privacy;
create trigger set_updated_at before update on public.body_privacy
  for each row execute function public.set_updated_at();

-- No API role may touch the PIN table directly. RLS on, no policies.
revoke all on table public.body_privacy from anon, authenticated;
grant select, insert, update, delete on table public.body_privacy to service_role;
alter table public.body_privacy enable row level security;

-- The shared account can no longer read or write weigh_ins directly.
-- Existing rows and the existing RLS policies stay; only the grants go.
revoke all on table public.weigh_ins from anon, authenticated;
grant select, insert, update, delete on table public.weigh_ins to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weigh_ins'
  ) then
    alter publication supabase_realtime drop table public.weigh_ins;
  end if;
end;
$$;

-- Internal: the profile's household, only when the caller belongs to it.
create or replace function public.body_profile_household(p_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  hid uuid;
begin
  select p.household_id into hid from public.profiles p where p.id = p_profile_id;
  if hid is null or not public.is_household_member(hid) then
    raise exception 'body_forbidden' using errcode = '42501';
  end if;
  return hid;
end;
$$;

-- Internal: checks the PIN. Returns true or false and counts failures (a
-- raised exception would roll the counter back). Five failures lock the
-- profile's body area for five minutes.
create or replace function public.body_check_pin(p_profile_id uuid, p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rec public.body_privacy%rowtype;
begin
  perform public.body_profile_household(p_profile_id);
  select * into rec from public.body_privacy where profile_id = p_profile_id for update;
  if not found then return 'unset'; end if;
  if rec.locked_until is not null and rec.locked_until > now() then return 'locked'; end if;
  if p_pin is null or crypt(p_pin, rec.pin_hash) <> rec.pin_hash then
    update public.body_privacy
      set failed_attempts = rec.failed_attempts + 1,
          locked_until = case when rec.failed_attempts + 1 >= 5
                              then now() + interval '5 minutes' else null end
      where profile_id = p_profile_id;
    return 'invalid';
  end if;
  if rec.failed_attempts <> 0 or rec.locked_until is not null then
    update public.body_privacy set failed_attempts = 0, locked_until = null
      where profile_id = p_profile_id;
  end if;
  return 'ok';
end;
$$;

-- Internal: the gate every read/write path goes through.
--
-- It raises, and a raise rolls the whole transaction back — including any
-- failed-attempt counter written on the way. That is why the throttle CANNOT
-- live here: ten wrong PINs through a data RPC left failed_attempts at zero,
-- so a 6-digit PIN was brute-forceable without limit.
--
-- The throttle therefore lives in body_unlock, which RETURNS its verdict so the
-- counter commits, and this gate additionally requires the capability a
-- successful unlock writes. Reaching a data RPC needs a live unlock, and the
-- only way to get one is through the throttled path.
create or replace function public.body_require_pin(p_profile_id uuid, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rec public.body_privacy%rowtype;
begin
  perform public.body_profile_household(p_profile_id);
  select * into rec from public.body_privacy where profile_id = p_profile_id;
  if not found then raise exception 'body_pin_unset' using errcode = '28000'; end if;
  if rec.locked_until is not null and rec.locked_until > now() then
    raise exception 'body_pin_locked' using errcode = '28000';
  end if;
  if rec.unlocked_until is null or rec.unlocked_until <= now() then
    raise exception 'body_pin_locked' using errcode = '28000';
  end if;
  if p_pin is null or crypt(p_pin, rec.pin_hash) <> rec.pin_hash then
    raise exception 'body_pin_invalid' using errcode = '28000';
  end if;
end;
$$;

-- 'unset' | 'set' | 'locked' — reveals nothing about the body data itself.
create or replace function public.body_pin_status(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  rec public.body_privacy%rowtype;
begin
  perform public.body_profile_household(p_profile_id);
  select * into rec from public.body_privacy where profile_id = p_profile_id;
  if not found then return 'unset'; end if;
  if rec.locked_until is not null and rec.locked_until > now() then return 'locked'; end if;
  return 'set';
end;
$$;

-- How long one successful unlock stays usable. Short enough that a forgotten
-- phone relocks by itself, long enough to add a weigh-in and read the trend.
create or replace function public.body_unlock_window()
returns interval language sql immutable as $$ select interval '10 minutes' $$;

-- The ONLY throttled entrance. Returns 'ok' | 'invalid' | 'locked' | 'unset'
-- instead of raising, so the failed-attempt counter actually commits. On 'ok'
-- it opens the capability window that body_require_pin insists on.
create or replace function public.body_unlock(p_profile_id uuid, p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  verdict text;
begin
  verdict := public.body_check_pin(p_profile_id, p_pin);
  if verdict = 'ok' then
    update public.body_privacy
      set unlocked_until = now() + public.body_unlock_window()
      where profile_id = p_profile_id;
  end if;
  return verdict;
end;
$$;

-- Explicit relock — leaving the area, switching profile, or signing out.
create or replace function public.body_lock(p_profile_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.body_profile_household(p_profile_id);
  update public.body_privacy set unlocked_until = null where profile_id = p_profile_id;
end;
$$;

-- First call sets the PIN; later calls must present the current PIN.
create or replace function public.body_set_pin(
  p_profile_id uuid, p_new_pin text, p_current_pin text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hid uuid;
  verdict text;
begin
  hid := public.body_profile_household(p_profile_id);
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'body_pin_format' using errcode = '22023';
  end if;
  if exists (select 1 from public.body_privacy where profile_id = p_profile_id) then
    verdict := public.body_check_pin(p_profile_id, p_current_pin);
    if verdict <> 'ok' then return verdict; end if;
    update public.body_privacy
      set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)), failed_attempts = 0,
          locked_until = null, unlocked_until = null
      where profile_id = p_profile_id;
  else
    insert into public.body_privacy (profile_id, household_id, pin_hash)
      values (p_profile_id, hid, crypt(p_new_pin, gen_salt('bf', 10)));
  end if;
  return 'ok';
end;
$$;

create or replace function public.body_list_weigh_ins(p_profile_id uuid, p_pin text)
returns table (
  id uuid, measured_on date, measured_at text, weight_kg numeric, body_fat_pct numeric,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.body_require_pin(p_profile_id, p_pin);
  return query
    select w.id, w.measured_on, w.measured_at, w.weight_kg, w.body_fat_pct, w.created_at
    from public.weigh_ins w
    where w.profile_id = p_profile_id
    order by w.measured_on desc, w.measured_at desc nulls last, w.created_at desc;
end;
$$;

create or replace function public.body_save_weigh_in(
  p_profile_id uuid, p_pin text, p_id uuid, p_measured_on date, p_measured_at text,
  p_weight_kg numeric, p_body_fat_pct numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  hid uuid;
  owner_id uuid;
  saved uuid;
begin
  perform public.body_require_pin(p_profile_id, p_pin);
  hid := public.body_profile_household(p_profile_id);
  select w.profile_id into owner_id from public.weigh_ins w where w.id = p_id;
  if owner_id is not null and owner_id <> p_profile_id then
    raise exception 'body_forbidden' using errcode = '42501';
  end if;
  insert into public.weigh_ins
    (id, household_id, profile_id, measured_on, measured_at, weight_kg, body_fat_pct)
    values (coalesce(p_id, gen_random_uuid()), hid, p_profile_id, p_measured_on, p_measured_at,
            p_weight_kg, p_body_fat_pct)
    on conflict (id) do update
      set measured_on = excluded.measured_on,
          measured_at = excluded.measured_at,
          weight_kg = excluded.weight_kg,
          body_fat_pct = excluded.body_fat_pct
    returning weigh_ins.id into saved;
  return saved;
end;
$$;

create or replace function public.body_delete_weigh_in(p_profile_id uuid, p_pin text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.body_require_pin(p_profile_id, p_pin);
  delete from public.weigh_ins w where w.id = p_id and w.profile_id = p_profile_id;
end;
$$;

-- Internal helpers are not callable by any API role.
revoke all on function public.body_profile_household(uuid) from public, anon, authenticated;
revoke all on function public.body_check_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.body_require_pin(uuid, text) from public, anon, authenticated;
-- The public entry points: authenticated household members only.
revoke all on function public.body_pin_status(uuid) from public, anon;
revoke all on function public.body_unlock(uuid, text) from public, anon;
revoke all on function public.body_lock(uuid) from public, anon;
revoke all on function public.body_unlock_window() from public, anon, authenticated;
revoke all on function public.body_set_pin(uuid, text, text) from public, anon;
revoke all on function public.body_list_weigh_ins(uuid, text) from public, anon;
revoke all on function public.body_save_weigh_in(uuid, text, uuid, date, text, numeric, numeric) from public, anon;
revoke all on function public.body_delete_weigh_in(uuid, text, uuid) from public, anon;
grant execute on function public.body_pin_status(uuid) to authenticated;
grant execute on function public.body_unlock(uuid, text) to authenticated;
grant execute on function public.body_lock(uuid) to authenticated;
grant execute on function public.body_set_pin(uuid, text, text) to authenticated;
grant execute on function public.body_list_weigh_ins(uuid, text) to authenticated;
grant execute on function public.body_save_weigh_in(uuid, text, uuid, date, text, numeric, numeric) to authenticated;
grant execute on function public.body_delete_weigh_in(uuid, text, uuid) to authenticated;

-- ROLLBACK (manual; not part of the migration):
--   grant select, insert, update, delete on public.weigh_ins to authenticated;
--   alter publication supabase_realtime add table public.weigh_ins;
--   drop function if exists public.body_delete_weigh_in(uuid, text, uuid);
--   drop function if exists public.body_save_weigh_in(uuid, text, uuid, date, text, numeric, numeric);
--   drop function if exists public.body_list_weigh_ins(uuid, text);
--   drop function if exists public.body_set_pin(uuid, text, text);
--   drop function if exists public.body_lock(uuid);
--   drop function if exists public.body_unlock(uuid, text);
--   drop function if exists public.body_unlock_window();
--   drop function if exists public.body_pin_status(uuid);
--   drop function if exists public.body_require_pin(uuid, text);
--   drop function if exists public.body_check_pin(uuid, text);
--   drop function if exists public.body_profile_household(uuid);
--   drop table if exists public.body_privacy;
--   alter table public.food_entries drop column if exists basis_snapshot,
--     drop column if exists calculated_revision, drop column if exists calculated_product_id;
--   drop table if exists public.calculated_products;
