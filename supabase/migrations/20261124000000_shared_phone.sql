-- One phone number on more than one account.
--
-- Run once in the Supabase SQL editor, after 20261025000000_rate_limits.sql.
--
-- Until now a phone number belonged to one account, and connecting it to a
-- second account folded the first into it. The owner wants several test
-- accounts on one phone, so only the email stays unique. A text is answered
-- by the account that connected the number most recently (phone_at), so
-- tapping "Connect by text" from another account moves the phone's texts
-- there, and nothing is merged or removed.

alter table public.accounts drop constraint accounts_phone_key;

alter table public.accounts
  -- When this account's number was last connected or confirmed. The latest wins the number's texts.
  add column phone_at timestamptz;

update public.accounts set phone_at = updated_at where phone is not null;

create index accounts_phone_idx on public.accounts (phone, phone_at desc) where phone is not null;

-- wally_sign_in, changed in two ways. A phone no longer folds accounts: with
-- p_link it is simply put on that account, whoever else has it. And a plain
-- sign-in by phone finds the account that connected the number most recently.
-- An email still belongs to one account, and still folds.
-- (Replacing a function keeps its grants.)
create or replace function public.wally_sign_in(
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

  if p_email is not null then
    select * into owner from public.accounts a where a.email = p_email for update;
  else
    select * into owner from public.accounts a
     where a.phone = p_phone
     order by a.phone_at desc nulls last, a.created_at desc
     limit 1
     for update;
  end if;

  if p_link is not null then
    select * into target from public.accounts a where a.id = p_link for update;
  end if;

  if target.id is null then
    -- Plain sign-in (or the account to link to is gone).
    if owner.id is null then
      insert into public.accounts (name, email, google, phone, phone_at, zip, suggestions)
      values (v_name, p_email, p_email is not null and coalesce(p_google, false), p_phone, case when p_phone is not null then clock_timestamp() end, p_zip, coalesce(p_suggestions, false))
      returning * into target;
      return target;
    end if;
    target := owner;
  elsif p_email is not null and owner.id is not null and owner.id <> target.id then
    -- Another account owns this email. Fold it into this one: its conversation
    -- moves over, then it is removed to free the email.
    update public.messages m set account_id = target.id where m.account_id = owner.id;
    delete from public.accounts a where a.id = owner.id;
    update public.accounts a set
      name        = case when a.name = '' then owner.name else a.name end,
      email       = coalesce(a.email, owner.email),
      google      = case when a.email is null then owner.google else a.google end,
      phone       = coalesce(a.phone, owner.phone),
      phone_at    = case when a.phone is null then owner.phone_at else a.phone_at end,
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
    -- Connecting or confirming the number makes this the account its texts go to.
    phone_at    = case when p_phone is not null then clock_timestamp() else a.phone_at end,
    name        = case when v_name <> '' and (p_typed or a.name = '') then v_name else a.name end,
    zip         = case when p_typed then coalesce(p_zip, a.zip) else coalesce(a.zip, p_zip) end,
    suggestions = case when p_typed then coalesce(p_suggestions, a.suggestions) else a.suggestions end,
    updated_at  = now()
  where a.id = target.id
  returning * into target;

  return target;
end;
$$;

-- wally_text_begin, unchanged except for which account a text belongs to:
-- the one that connected the number most recently.
create or replace function public.wally_text_begin(
  p_phone       text,
  p_content     text,
  p_external    text,
  p_daily_limit integer,
  p_history     integer
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_first   boolean;
  v_id      bigint;
begin
  select * into v_account from public.accounts a
   where a.phone = p_phone
   order by a.phone_at desc nulls last, a.created_at desc
   limit 1
   for update;
  if v_account.id is null then
    return jsonb_build_object('status', 'unknown');
  end if;
  if p_external is not null and exists (select 1 from public.messages m where m.external_id = p_external) then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if v_account.text_stopped then
    return jsonb_build_object('status', 'stopped');
  end if;
  if (select count(*) from public.messages m
       where m.account_id = v_account.id and m.role = 'user' and m.created_at > now() - interval '24 hours') >= p_daily_limit then
    return jsonb_build_object('status', 'limited');
  end if;

  v_first := not exists (select 1 from public.messages m where m.account_id = v_account.id and m.channel = 'text');

  insert into public.messages (account_id, role, channel, content, external_id)
  values (v_account.id, 'user', 'text', p_content, p_external)
  returning id into v_id;

  return jsonb_build_object(
    'status', 'ok',
    'id', v_id,
    'first', v_first,
    'account', to_jsonb(v_account),
    'messages', public.wally_messages(v_account.id, p_history)
  );
end;
$$;

-- wally_text_stop is unchanged: STOP and START reach every account with the number.

notify pgrst, 'reload schema';
