-- Lets the server use the rate-limit table.
--
-- Run once in the Supabase SQL editor, after 20261124000000_shared_phone.sql.
--
-- 20261025000000_rate_limits.sql created public.rate_limits without granting
-- it to service_role, unlike accounts and messages. wally_rate_hit runs as its
-- caller, so in production every call failed with "permission denied for table
-- rate_limits" and, since the limiter fails open, no limit was ever enforced
-- (seen in the server log on 2026-11-24).

grant select, insert, update, delete on table public.rate_limits to service_role;
