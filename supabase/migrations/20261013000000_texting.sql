-- Texting Wally.
--
-- Run once in the Supabase SQL editor, after 20261012010000_address.sql.
--
-- A text joins the same thread as the website: it is matched to an account
-- by the phone number it came from, which the person verified at sign-up.
-- Same access rules as before: nothing here is open to anon or authenticated.

alter table public.messages
  -- The texting provider's own id for a message it delivered to us. Providers
  -- retry deliveries, and this is how a repeat is recognised.
  add column external_id text;

create unique index messages_external_idx on public.messages (external_id) where external_id is not null;

alter table public.accounts
  -- True after the person texts STOP. Wally sends them nothing until they text START.
  add column text_stopped boolean not null default false;

-- Records a text the person sent and returns the thread for Wally to answer.
--
--   {"status": "ok", "id", "first", "account": {...}, "messages": [...]}
--       "first" is true when this is the first text in the thread, which is
--       when Wally introduces himself and sends his contact card.
--   {"status": "unknown"}    no account has this phone number
--   {"status": "duplicate"}  this delivery was already recorded
--   {"status": "stopped"}    the person texted STOP
--   {"status": "limited"}    more than p_daily_limit messages in the last 24 hours
create function public.wally_text_begin(
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
  select * into v_account from public.accounts a where a.phone = p_phone for update;
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

-- STOP and START. True if an account has this phone number.
create function public.wally_text_stop(p_phone text, p_stopped boolean) returns boolean
language sql
set search_path = ''
as $$
  with changed as (
    update public.accounts set text_stopped = p_stopped, updated_at = now() where phone = p_phone returning 1
  )
  select exists (select 1 from changed);
$$;

-- The thread as the page and Wally read it, now without the provider's id.
create or replace function public.wally_messages(p_account uuid, p_limit integer) returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(m) - 'account_id' - 'external_id' order by m.id), '[]'::jsonb)
  from (
    select * from public.messages where account_id = p_account order by id desc limit greatest(p_limit, 0)
  ) m;
$$;

revoke all on function
  public.wally_text_begin(text, text, text, integer, integer),
  public.wally_text_stop(text, boolean)
from public, anon, authenticated;

grant execute on function
  public.wally_text_begin(text, text, text, integer, integer),
  public.wally_text_stop(text, boolean)
to service_role;

notify pgrst, 'reload schema';
