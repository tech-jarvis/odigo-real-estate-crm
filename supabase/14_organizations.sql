-- ============================================================
-- Odigo CRM — Organizations (14)
--
-- Multi-org foundation. One row per tenant. profiles.org_id ties every
-- user to exactly one org; every CRM business-data table gets its own
-- org_id in migration 15, scoped by RLS in migration 16.
-- ============================================================

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug) values
  ('0794fb70-3922-4b62-a704-15949daa9a80', 'Odigo SMB',        'odigo-smb'),
  ('c501b923-3caf-42e5-877a-5f37a60d6f77', 'Odigo Enterprise', 'odigo-enterprise'),
  ('f9768dd9-8aa7-433f-8026-58bb56e36b2e', 'ContentGen',       'contentgen');

alter table public.organizations enable row level security;

-- Every authenticated user can read the org list (needed to resolve their
-- own org via current_org_id() in migration 16). No insert/update/delete
-- policy — orgs are provisioned out-of-band (service-role only), matching
-- D2's admin-assigned org+role model.
create policy "organizations_select_auth" on public.organizations
  for select to authenticated using (true);
