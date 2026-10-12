-- A saved address, so Wally can find what is close.
--
-- Run once in the Supabase SQL editor, after 20261012000000_messages.sql.
--
-- The address and its coordinates sit on the account row, so the existing
-- rules cover them: only the server can read them, and erasing the account
-- erases them.

alter table public.accounts
  -- As the address lookup wrote it back, e.g. "5905 Wilshire Blvd, Los Angeles, CA 90036, USA".
  add column address text,
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  -- All three together, or none.
  add constraint accounts_address_whole check ((address is null) = (lat is null) and (lat is null) = (lng is null));

-- Saves the address, or clears it when all three are null. No rows if the account is gone.
create function public.wally_set_address(p_id uuid, p_address text, p_lat double precision, p_lng double precision)
returns setof public.accounts
language sql
set search_path = ''
as $$
  update public.accounts set address = p_address, lat = p_lat, lng = p_lng, updated_at = now() where id = p_id returning *;
$$;

revoke all on function public.wally_set_address(uuid, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.wally_set_address(uuid, text, double precision, double precision) to service_role;

notify pgrst, 'reload schema';
