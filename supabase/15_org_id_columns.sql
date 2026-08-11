-- ============================================================
-- Odigo CRM — org_id columns (15)
--
-- Adds org_id to the five tables holding org-scoped business data.
-- project_contacts, oauth_tokens, mcp_auth_codes, calendar_connect_tokens
-- deliberately do NOT get their own org_id — they derive org membership
-- transitively (project_contacts via projects/contacts; the token tables
-- via user_id/auth.uid()), so RLS in migration 16 checks that join instead
-- of duplicating the column.
--
-- All existing rows in this dev database predate multi-org and get
-- backfilled to Odigo SMB (0794fb70-3922-4b62-a704-15949daa9a80) — the
-- only org seeded with live data per the V2 kickoff doc.
-- ============================================================

alter table public.profiles     add column org_id uuid references public.organizations(id);
alter table public.companies    add column org_id uuid references public.organizations(id);
alter table public.contacts     add column org_id uuid references public.organizations(id);
alter table public.projects     add column org_id uuid references public.organizations(id);
alter table public.activity_log add column org_id uuid references public.organizations(id);

update public.profiles     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.companies    set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.contacts     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.projects     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.activity_log set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;

alter table public.profiles     alter column org_id set not null;
alter table public.companies    alter column org_id set not null;
alter table public.contacts     alter column org_id set not null;
alter table public.projects     alter column org_id set not null;
alter table public.activity_log alter column org_id set not null;

create index idx_profiles_org on public.profiles(org_id);
create index idx_companies_org on public.companies(org_id);
create index idx_contacts_org on public.contacts(org_id);
create index idx_projects_org on public.projects(org_id);
create index idx_activity_org on public.activity_log(org_id);

-- handle_new_user() must assign an org on signup. D2 (org & user provisioning)
-- replaces this with an admin-assigned org+role; until then, default new
-- signups to Odigo SMB so the trigger keeps working end-to-end.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer',
    '0794fb70-3922-4b62-a704-15949daa9a80'
  );
  return new;
end;
$$;
