-- ============================================================
-- Odigo CRM — MCP Auth Codes Security Hardening (11)
-- Fixes:
--   1. Add missing refresh_token column (code expected it, migration lacked it)
--   2. Enable RLS — without it, the anon key can read plaintext tokens
--   3. Auto-cleanup expired codes via pg_cron
-- ============================================================

-- 1. Add refresh_token column that the store.ts code expects
alter table public.mcp_auth_codes
  add column if not exists refresh_token text;

-- 2. Enable RLS — all direct access blocked for anon / authenticated roles.
--    The service-role key used by the MCP backend bypasses RLS entirely,
--    so backend reads/writes are unaffected.
alter table public.mcp_auth_codes enable row level security;

create policy "mcp_auth_codes_no_direct_access" on public.mcp_auth_codes
  for all using (false);

-- 3. Cleanup expired codes (runs every 10 minutes via pg_cron)
create or replace function public.cleanup_expired_mcp_auth_codes()
  returns void language plpgsql security definer as $$
begin
  delete from public.mcp_auth_codes where expires_at < now();
end;
$$;

select cron.schedule(
  'cleanup-mcp-auth-codes',
  '*/10 * * * *',
  $$select public.cleanup_expired_mcp_auth_codes()$$
);
