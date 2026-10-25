-- Rate limits for the endpoints that cost money before anyone is signed in
-- (a verification text through Twilio, a sign-in email through Resend), and
-- an index for the daily message cap.
--
-- Run once in the Supabase SQL editor, after 20261013000000_texting.sql.

-- One row per (what is being limited, who): a fixed window that starts on the
-- first hit and is replaced once it has passed. Keys are hashed by the server
-- (sha256 of e.g. "verify:ip:1.2.3.4"), so no phone, email or IP is stored.
create table public.rate_limits (
  key        text primary key,
  hits       integer not null default 1,
  window_end timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one hit against p_key. Returns true when this hit is within p_limit
-- hits per p_window, false (and still counts) when it is over.
create function public.wally_rate_hit(p_key text, p_limit integer, p_window interval)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits (key, hits, window_end)
  values (p_key, 1, now() + p_window)
  on conflict (key) do update set
    hits       = case when public.rate_limits.window_end <= now() then 1 else public.rate_limits.hits + 1 end,
    window_end = case when public.rate_limits.window_end <= now() then now() + p_window else public.rate_limits.window_end end
  returning hits into v_hits;
  -- Keep the table small: rows whose window closed a day ago are never read again.
  if random() < 0.01 then
    delete from public.rate_limits r where r.window_end < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.wally_rate_hit(text, integer, interval) from public, anon, authenticated;
grant execute on function public.wally_rate_hit(text, integer, interval) to service_role;

-- wally_chat_begin and wally_text_begin count a person's messages over the
-- last 24 hours on every turn. Threads are never pruned, so give that count
-- its own index instead of walking the whole thread.
create index messages_daily_idx on public.messages (account_id, created_at) where role = 'user';

notify pgrst, 'reload schema';
