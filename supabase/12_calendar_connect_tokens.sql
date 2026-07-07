-- ============================================================
-- Odigo CRM — Calendar Connect Tokens (12)
-- Short-lived one-time tokens that let the CRM sidebar
-- securely hand off a user's identity to the MCP server's
-- calendar OAuth flow without exposing a Supabase JWT as a
-- query parameter.
-- ============================================================

create table if not exists public.calendar_connect_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.calendar_connect_tokens enable row level security;

-- Authenticated users may insert their own token only.
-- The MCP backend (service-role) consumes + deletes it.
create policy "calendar_connect_tokens_user_insert"
  on public.calendar_connect_tokens
  for insert to authenticated
  with check (auth.uid() = user_id);

-- No direct read/update/delete for any client role.
create policy "calendar_connect_tokens_no_read"
  on public.calendar_connect_tokens
  for select using (false);

-- Allow users to also read their own connected providers
-- (used by the /api/calendar/status CRM route to know which
-- calendars are already connected for the current admin).
create policy "oauth_tokens_select_own"
  on public.oauth_tokens
  for select to authenticated
  using (auth.uid() = user_id);

-- Cleanup expired connect tokens every 10 minutes
create or replace function public.cleanup_expired_calendar_connect_tokens()
  returns void language plpgsql security definer as $$
begin
  delete from public.calendar_connect_tokens where expires_at < now();
end;
$$;

select cron.schedule(
  'cleanup-calendar-connect-tokens',
  '*/10 * * * *',
  $$select public.cleanup_expired_calendar_connect_tokens()$$
);
