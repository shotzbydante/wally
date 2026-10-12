-- Wally accounts.
--
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- The web app keeps its own sign-in (Google, email link, text code) and uses
-- Supabase only as a Postgres database. It talks to it from the server with
-- the project's secret key, and only through the functions below. Nothing here
-- is reachable with the publishable (anon) key: row level security is on with
-- no policies, and the functions are granted to service_role alone.

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  -- Verified by an emailed link or by Google. Always lowercase.
  email       text unique check (email = lower(email)),
  -- True when Google confirmed the email above.
  google      boolean not null default false,
  -- Verified 10-digit US number.
  phone       text unique check (phone ~ '^[0-9]{10}$'),
  zip         text check (zip ~ '^[0-9]{5}$'),
  suggestions boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- An account with no way to sign in to it is unreachable.
  constraint accounts_has_identity check (email is not null or phone is not null)
);

-- Emailed sign-in links that have been opened, so each works once.
-- Only a hash of the link is kept.
create table public.used_sign_in_links (
  token_hash text primary key,
  expires_at timestamptz not null
);

alter table public.accounts enable row level security;
alter table public.used_sign_in_links enable row level security;
revoke all on table public.accounts, public.used_sign_in_links from anon, authenticated;
grant select, insert, update, delete on table public.accounts, public.used_sign_in_links to service_role;

-- Signs in with a verified email or phone and returns the account.
--
-- Without p_link this is a plain sign-in: the account that owns the email or
-- phone is returned, or a new one is created. It never touches whichever
-- account the browser was signed in to before, so two people sharing a
-- browser can't end up in one account by accident.
--
-- With p_link (an account id) the person asked, from their account page, to
-- add this email or phone to that account. If another account already owns
-- it, that account is folded into p_link and removed. When more tables hang
-- off accounts (orders, taste, ledger), the fold has to move those rows too.
--
-- p_typed means name, ZIP and suggestions were typed by the person during
-- sign-up, so they replace what is stored. Otherwise a name (from Google,
-- say) only fills an empty one.
create function public.wally_sign_in(
  p_link        uuid,
  p_email       text,
  p_google      boolean,
  p_phone       text,
  p_name        text,
  p_zip         text,
  p_suggestions boolean,
  p_typed       boolean
) returns public.accounts
language plpgsql
set search_path = ''
as $$
declare
  target public.accounts;
  owner  public.accounts;
  v_name text := coalesce(btrim(p_name), '');
begin
  if (p_email is null) = (p_phone is null) then
    raise exception 'wally_sign_in takes exactly one of email or phone';
  end if;

  -- One sign-in at a time per email or phone, so two tabs can't both create it.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_email, p_phone), 0));

  select * into owner from public.accounts a
   where (p_email is not null and a.email = p_email)
      or (p_phone is not null and a.phone = p_phone)
   for update;

  if p_link is not null then
    select * into target from public.accounts a where a.id = p_link for update;
  end if;

  if target.id is null then
    -- Plain sign-in (or the account to link to is gone).
    if owner.id is null then
      insert into public.accounts (name, email, google, phone, zip, suggestions)
      values (v_name, p_email, p_email is not null and coalesce(p_google, false), p_phone, p_zip, coalesce(p_suggestions, false))
      returning * into target;
      return target;
    end if;
    target := owner;
  elsif owner.id is not null and owner.id <> target.id then
    -- Fold the other account into this one. Remove it first to free its
    -- unique email and phone.
    delete from public.accounts a where a.id = owner.id;
    update public.accounts a set
      name        = case when a.name = '' then owner.name else a.name end,
      email       = coalesce(a.email, owner.email),
      google      = case when a.email is null then owner.google else a.google end,
      phone       = coalesce(a.phone, owner.phone),
      zip         = coalesce(a.zip, owner.zip),
      suggestions = a.suggestions or owner.suggestions
    where a.id = target.id
    returning * into target;
  end if;

  update public.accounts a set
    email       = coalesce(p_email, a.email),
    google      = case
                    when p_email is null then a.google
                    when coalesce(p_google, false) then true
                    -- A different address by email link: Google never confirmed that one.
                    when a.email is distinct from p_email then false
                    else a.google
                  end,
    phone       = coalesce(p_phone, a.phone),
    name        = case when v_name <> '' and (p_typed or a.name = '') then v_name else a.name end,
    zip         = case when p_typed then coalesce(p_zip, a.zip) else coalesce(a.zip, p_zip) end,
    suggestions = case when p_typed then coalesce(p_suggestions, a.suggestions) else a.suggestions end,
    updated_at  = now()
  where a.id = target.id
  returning * into target;

  return target;
end;
$$;

-- The account, or no rows if it has been erased.
create function public.wally_account(p_id uuid) returns setof public.accounts
language sql stable
set search_path = ''
as $$
  select * from public.accounts where id = p_id;
$$;

create function public.wally_set_name(p_id uuid, p_name text) returns setof public.accounts
language sql
set search_path = ''
as $$
  update public.accounts set name = btrim(p_name), updated_at = now() where id = p_id returning *;
$$;

-- Erases the account. True if there was one.
create function public.wally_delete_account(p_id uuid) returns boolean
language sql
set search_path = ''
as $$
  with gone as (delete from public.accounts where id = p_id returning 1)
  select exists (select 1 from gone);
$$;

-- Marks an emailed sign-in link as opened. True the first time, false after.
create function public.wally_use_link(p_token_hash text, p_expires_at timestamptz) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  added integer;
begin
  delete from public.used_sign_in_links where expires_at < now();
  insert into public.used_sign_in_links (token_hash, expires_at)
  values (p_token_hash, p_expires_at)
  on conflict do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;

-- Supabase lets every API role run new functions by default. Only the
-- server's secret key (service_role) may run these.
revoke all on function
  public.wally_sign_in(uuid, text, boolean, text, text, text, boolean, boolean),
  public.wally_account(uuid),
  public.wally_set_name(uuid, text),
  public.wally_delete_account(uuid),
  public.wally_use_link(text, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.wally_sign_in(uuid, text, boolean, text, text, text, boolean, boolean),
  public.wally_account(uuid),
  public.wally_set_name(uuid, text),
  public.wally_delete_account(uuid),
  public.wally_use_link(text, timestamptz)
to service_role;

-- Tell the API layer about the new functions right away.
notify pgrst, 'reload schema';
