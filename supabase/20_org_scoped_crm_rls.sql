-- ============================================================
-- Odigo CRM — org_id + org-scoped RLS on CRM tables (20)
-- Depends on: 18_org_members.sql, 19_org_members_rls.sql
--
-- This file DOCUMENTS a fix that was already applied directly
-- against the live database (out-of-band, not through a checked-in
-- migration) before this repo tracked it. companies, contacts,
-- projects, and activity_log had no org_id column and no org-based
-- RLS at all — every row was readable by any authenticated user and
-- writable by any admin, regardless of organization. That gap is
-- already closed live; this migration exists so the fix survives a
-- database rebuild and is reviewable in git.
--
-- Every statement below is written to be a safe no-op against a
-- database that already has this state (this project, today) while
-- still fully applying it to a database that only has migrations
-- through 19 (e.g. a fresh environment rebuilt from these files).
--
-- project_contacts intentionally gets no org_id column — it's a
-- pure join table between projects and contacts, both of which get
-- their own org_id, so its policies derive org membership via joins
-- instead.
--
-- org_id foreign keys use ON DELETE CASCADE, matching the convention
-- already used on org_roles/invitations — deleting an organization
-- deletes its companies/contacts/projects/activity_log rows too.
--
-- All policies below DO include an is_super_admin() bypass, matching
-- the org_roles/role_permissions/invitations convention — a super
-- admin can read/manage any org's CRM data, not just their own
-- current_org_id().
-- ============================================================

-- ---------- Step 1: org_id columns ----------
alter table public.companies    add column if not exists org_id uuid;
alter table public.contacts     add column if not exists org_id uuid;
alter table public.projects     add column if not exists org_id uuid;
alter table public.activity_log add column if not exists org_id uuid;

-- ---------- Step 2: explicit-target backfill for any pre-existing null org_id ----------
-- On this database every row already has org_id set (this just documents
-- the fix). On a database rebuilt from migrations only through 19, rows
-- would still have org_id = null at this point, and the placeholder below
-- must be filled in with the real owning org before running.
do $$
declare
  target_org uuid := '00000000-0000-0000-0000-000000000000'; -- <FILL IN if any org_id is still null — see check below>
  null_count int;
begin
  select count(*) into null_count from (
    select org_id from public.companies    where org_id is null
    union all select org_id from public.contacts     where org_id is null
    union all select org_id from public.projects     where org_id is null
    union all select org_id from public.activity_log where org_id is null
  ) t;

  if null_count = 0 then
    return; -- already fully backfilled (true today) — nothing to do
  end if;

  if target_org = '00000000-0000-0000-0000-000000000000' then
    raise exception
      '20_org_scoped_crm_rls.sql: % row(s) still have a null org_id and the '
      'target_org placeholder was not replaced. Run '
      '`select id, name from public.organizations;`, pick the org that owns '
      'the null-org_id rows, and hardcode its id here before running this migration.',
      null_count;
  end if;

  if not exists (select 1 from public.organizations where id = target_org) then
    raise exception '20_org_scoped_crm_rls.sql: target_org % does not exist in public.organizations.', target_org;
  end if;

  update public.companies    set org_id = target_org where org_id is null;
  update public.contacts     set org_id = target_org where org_id is null;
  update public.projects     set org_id = target_org where org_id is null;
  update public.activity_log set org_id = target_org where org_id is null;
end $$;

-- ---------- Step 3: NOT NULL ----------
alter table public.companies    alter column org_id set not null;
alter table public.contacts     alter column org_id set not null;
alter table public.projects     alter column org_id set not null;
alter table public.activity_log alter column org_id set not null;

-- ---------- Step 4: FK to organizations (CASCADE, drop-then-create so re-running upgrades an older NO ACTION constraint) ----------
alter table public.companies    drop constraint if exists companies_org_id_fkey;
alter table public.contacts     drop constraint if exists contacts_org_id_fkey;
alter table public.projects     drop constraint if exists projects_org_id_fkey;
alter table public.activity_log drop constraint if exists activity_log_org_id_fkey;

alter table public.companies add constraint companies_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;
alter table public.contacts add constraint contacts_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;
alter table public.projects add constraint projects_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;
alter table public.activity_log add constraint activity_log_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- ---------- Step 5: indexes (names match live) ----------
create index if not exists idx_companies_org on public.companies(org_id);
create index if not exists idx_contacts_org  on public.contacts(org_id);
create index if not exists idx_projects_org  on public.projects(org_id);
create index if not exists idx_activity_org  on public.activity_log(org_id);

-- ---------- Step 6: default for RLS-authenticated inserts ----------
-- Lets bare INSERTs from companies/actions.ts, pipeline/actions.ts,
-- pipeline/[slug]/activity-actions.ts (none of which set org_id
-- explicitly) keep working: org_id is filled in from the inserting
-- user's current_org_id() when omitted.
-- Service-role (MCP) connections have no auth.uid() session, so
-- current_org_id() evaluates to NULL for them — this default does
-- NOT help those callers, which must pass org_id explicitly.
alter table public.companies    alter column org_id set default public.current_org_id();
alter table public.contacts     alter column org_id set default public.current_org_id();
alter table public.projects     alter column org_id set default public.current_org_id();
alter table public.activity_log alter column org_id set default public.current_org_id();

-- ---------- Step 7: org-scoped RLS with super-admin bypass (drop-then-create, safe to rerun) ----------

-- companies
drop policy if exists "companies_select_auth"  on public.companies;
drop policy if exists "companies_select_org"   on public.companies;
drop policy if exists "companies_insert_admin" on public.companies;
drop policy if exists "companies_update_admin" on public.companies;
drop policy if exists "companies_delete_admin" on public.companies;

create policy "companies_select_org" on public.companies
  for select to authenticated
  using (org_id = public.current_org_id() or public.is_super_admin());

create policy "companies_insert_admin" on public.companies
  for insert to authenticated
  with check (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  );

create policy "companies_update_admin" on public.companies
  for update to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  );

create policy "companies_delete_admin" on public.companies
  for delete to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  );

-- contacts (company_id is NOT NULL — always verify parent company's org matches)
drop policy if exists "contacts_select_auth"  on public.contacts;
drop policy if exists "contacts_select_org"   on public.contacts;
drop policy if exists "contacts_insert_admin" on public.contacts;
drop policy if exists "contacts_update_admin" on public.contacts;
drop policy if exists "contacts_delete_admin" on public.contacts;

create policy "contacts_select_org" on public.contacts
  for select to authenticated
  using (org_id = public.current_org_id() or public.is_super_admin());

create policy "contacts_insert_admin" on public.contacts
  for insert to authenticated
  with check (
    (
      public.is_admin()
      and org_id = public.current_org_id()
      and exists (
        select 1 from public.companies c
        where c.id = contacts.company_id and c.org_id = public.current_org_id()
      )
    )
    or public.is_super_admin()
  );

create policy "contacts_update_admin" on public.contacts
  for update to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  )
  with check (
    (
      public.is_admin()
      and org_id = public.current_org_id()
      and exists (
        select 1 from public.companies c
        where c.id = contacts.company_id and c.org_id = public.current_org_id()
      )
    )
    or public.is_super_admin()
  );

create policy "contacts_delete_admin" on public.contacts
  for delete to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  );

-- projects (company_id is nullable — only verify parent company's org when set)
drop policy if exists "projects_select_auth"  on public.projects;
drop policy if exists "projects_select_org"   on public.projects;
drop policy if exists "projects_insert_admin" on public.projects;
drop policy if exists "projects_update_admin" on public.projects;
drop policy if exists "projects_delete_admin" on public.projects;

create policy "projects_select_org" on public.projects
  for select to authenticated
  using (org_id = public.current_org_id() or public.is_super_admin());

create policy "projects_insert_admin" on public.projects
  for insert to authenticated
  with check (
    (
      public.is_admin()
      and org_id = public.current_org_id()
      and (
        company_id is null
        or exists (
          select 1 from public.companies c
          where c.id = projects.company_id and c.org_id = public.current_org_id()
        )
      )
    )
    or public.is_super_admin()
  );

create policy "projects_update_admin" on public.projects
  for update to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  )
  with check (
    (
      public.is_admin()
      and org_id = public.current_org_id()
      and (
        company_id is null
        or exists (
          select 1 from public.companies c
          where c.id = projects.company_id and c.org_id = public.current_org_id()
        )
      )
    )
    or public.is_super_admin()
  );

create policy "projects_delete_admin" on public.projects
  for delete to authenticated
  using (
    (public.is_admin() and org_id = public.current_org_id())
    or public.is_super_admin()
  );

-- project_contacts (no own org_id — derives org via projects/contacts joins)
drop policy if exists "project_contacts_select_auth"  on public.project_contacts;
drop policy if exists "project_contacts_select_org"   on public.project_contacts;
drop policy if exists "project_contacts_insert_admin" on public.project_contacts;
drop policy if exists "project_contacts_delete_admin" on public.project_contacts;

create policy "project_contacts_select_org" on public.project_contacts
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_contacts.project_id
        and p.org_id = public.current_org_id()
    )
  );

create policy "project_contacts_insert_admin" on public.project_contacts
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_admin()
      and exists (
        select 1 from public.projects p
        where p.id = project_contacts.project_id
          and p.org_id = public.current_org_id()
      )
      and exists (
        select 1 from public.contacts ct
        where ct.id = project_contacts.contact_id
          and ct.org_id = public.current_org_id()
      )
    )
  );

create policy "project_contacts_delete_admin" on public.project_contacts
  for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_admin()
      and exists (
        select 1 from public.projects p
        where p.id = project_contacts.project_id
          and p.org_id = public.current_org_id()
      )
    )
  );

-- activity_log (append-only — no update/delete policy, matching live + 02_rls.sql)
drop policy if exists "activity_select_auth"  on public.activity_log;
drop policy if exists "activity_select_org"   on public.activity_log;
drop policy if exists "activity_insert_admin" on public.activity_log;

create policy "activity_select_org" on public.activity_log
  for select to authenticated
  using (org_id = public.current_org_id() or public.is_super_admin());

create policy "activity_insert_admin" on public.activity_log
  for insert to authenticated
  with check (
    (
      public.is_admin()
      and author_id = auth.uid()
      and org_id = public.current_org_id()
      and exists (
        select 1 from public.projects p
        where p.id = activity_log.project_id
          and p.org_id = public.current_org_id()
      )
    )
    or public.is_super_admin()
  );
