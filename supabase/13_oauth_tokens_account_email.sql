-- ============================================================
-- Odigo CRM — OAuth Account Email (13)
-- Stores the connected Google/Outlook account's email address
-- so the CRM sidebar can show *which* account is linked, not
-- just that some account is connected.
-- ============================================================

alter table public.oauth_tokens
  add column if not exists account_email text;
