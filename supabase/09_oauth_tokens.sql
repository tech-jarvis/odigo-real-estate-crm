-- ============================================================
-- Odigo CRM — OAuth Tokens (09)
-- Stores provider refresh tokens for Google Calendar and Outlook.
-- ============================================================

create table if not exists public.oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('google', 'outlook')),
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_tokens enable row level security;

-- Only admins can read/write oauth tokens (service-role bypasses RLS)
create policy "oauth_tokens_select_admin" on public.oauth_tokens
  for select to authenticated using (public.is_admin());
create policy "oauth_tokens_insert_admin" on public.oauth_tokens
  for insert to authenticated with check (public.is_admin());
create policy "oauth_tokens_update_admin" on public.oauth_tokens
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "oauth_tokens_delete_admin" on public.oauth_tokens
  for delete to authenticated using (public.is_admin());

create trigger trg_oauth_tokens_updated before update on public.oauth_tokens
  for each row execute function public.set_updated_at();

create index idx_oauth_tokens_user_provider on public.oauth_tokens(user_id, provider);
