-- Wally's conversation with each person.
--
-- Run once in the Supabase SQL editor, after 20261011000000_accounts.sql.
--
-- There is one thread per account, whatever channel a message came through.
-- The web chat writes to it now; the texting agent will read and write the
-- same rows, which is what keeps the two in step.
--
-- Same access rules as accounts: row level security on with no policies, and
-- functions granted to service_role only.

create table public.messages (
  id         bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  -- Where the message was typed or sent: the website, or a text thread.
  channel    text not null check (channel in ('web', 'text')),
  -- What was said, as plain text.
  content    text not null,
  -- Options Wally offered with this message, shown as cards on the web and as
  -- a numbered list by text: [{"emoji","title","detail","reply"}].
  choices    jsonb check (choices is null or jsonb_typeof(choices) = 'array'),
  created_at timestamptz not null default now(),
  constraint messages_not_empty check (content <> '' or choices is not null)
);

create index messages_account_idx on public.messages (account_id, id);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select, insert, update, delete on table public.messages to service_role;

-- The last p_limit messages of a thread, oldest first, as a JSON array.
create function public.wally_messages(p_account uuid, p_limit integer) returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(m) - 'account_id' order by m.id), '[]'::jsonb)
  from (
    select * from public.messages where account_id = p_account order by id desc limit greatest(p_limit, 0)
  ) m;
$$;

-- Records what the person said and returns the thread for Wally to answer.
--
--   {"status": "ok", "id": <new message id>, "messages": [...]}
--   {"status": "limited"}  more than p_daily_limit messages in the last 24 hours
--   {"status": "gone"}     the account has been erased
--
-- The account row is locked first, so two messages sent at once are taken
-- one after the other.
create function public.wally_chat_begin(
  p_account     uuid,
  p_channel     text,
  p_content     text,
  p_daily_limit integer,
  p_history     integer
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform 1 from public.accounts a where a.id = p_account for update;
  if not found then
    return jsonb_build_object('status', 'gone');
  end if;

  if (select count(*) from public.messages m
       where m.account_id = p_account and m.role = 'user' and m.created_at > now() - interval '24 hours') >= p_daily_limit then
    return jsonb_build_object('status', 'limited');
  end if;

  insert into public.messages (account_id, role, channel, content)
  values (p_account, 'user', p_channel, p_content)
  returning id into v_id;

  return jsonb_build_object('status', 'ok', 'id', v_id, 'messages', public.wally_messages(p_account, p_history));
end;
$$;

-- Records Wally's answer and returns it as stored. Null if the account is gone.
create function public.wally_chat_reply(
  p_account uuid,
  p_channel text,
  p_content text,
  p_choices jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row public.messages;
begin
  if not exists (select 1 from public.accounts a where a.id = p_account) then
    return null;
  end if;
  insert into public.messages (account_id, role, channel, content, choices)
  values (p_account, 'assistant', p_channel, p_content, p_choices)
  returning * into v_row;
  return to_jsonb(v_row) - 'account_id';
end;
$$;

-- Takes back a message Wally could not answer, so it can be sent again.
create function public.wally_chat_undo(p_account uuid, p_id bigint) returns void
language sql
set search_path = ''
as $$
  delete from public.messages where account_id = p_account and id = p_id and role = 'user';
$$;

-- Erases the whole conversation. Returns how many messages were removed.
create function public.wally_clear_messages(p_account uuid) returns integer
language sql
set search_path = ''
as $$
  with gone as (delete from public.messages where account_id = p_account returning 1)
  select count(*)::integer from gone;
$$;

revoke all on function
  public.wally_messages(uuid, integer),
  public.wally_chat_begin(uuid, text, text, integer, integer),
  public.wally_chat_reply(uuid, text, text, jsonb),
  public.wally_chat_undo(uuid, bigint),
  public.wally_clear_messages(uuid)
from public, anon, authenticated;

grant execute on function
  public.wally_messages(uuid, integer),
  public.wally_chat_begin(uuid, text, text, integer, integer),
  public.wally_chat_reply(uuid, text, text, jsonb),
  public.wally_chat_undo(uuid, bigint),
  public.wally_clear_messages(uuid)
to service_role;

-- wally_sign_in, unchanged except that folding one account into another now
-- carries its conversation across. (Replacing a function keeps its grants.)
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
    -- Fold the other account into this one: its conversation moves over,
    -- then it is removed to free its unique email and phone.
    update public.messages m set account_id = target.id where m.account_id = owner.id;
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

notify pgrst, 'reload schema';
