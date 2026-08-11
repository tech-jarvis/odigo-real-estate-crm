-- ============================================================
-- Odigo CRM — org-scoped RLS rewrite (16)
--
-- Adds an org boundary on top of the existing admin/viewer model from
-- 02_rls.sql: every authenticated user can only see/write rows in their
-- own org, on top of (not instead of) the existing role checks.
--
-- Scope: the six tables 02_rls.sql covers (profiles, companies, contacts,
-- projects, project_contacts, activity_log). oauth_tokens, mcp_auth_codes,
-- calendar_connect_tokens are left untouched — they're keyed by
-- user_id/auth.uid(), not shared CRM data, so there's no cross-org leak
-- vector to close there.
-- ============================================================

-- ---------- Helper: current user's org ----------
-- SECURITY DEFINER so it can read profiles without recursing through
-- profiles' own RLS policy (same pattern as is_admin() in 01_schema.sql).
create or replace function public.current_org_id()
returns uuid language sql security definer stable set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_org_id() from anon, public;
grant  execute on function public.current_org_id() to authenticated;

-- ---------- profiles ----------
drop policy "profiles_select_auth" on public.profiles;
create policy "profiles_select_org" on public.profiles
  for select to authenticated using (org_id = public.current_org_id());

drop policy "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());

-- ---------- companies ----------
drop policy "companies_select_auth" on public.companies;
create policy "companies_select_org" on public.companies
  for select to authenticated using (org_id = public.current_org_id());

drop policy "companies_insert_admin" on public.companies;
create policy "companies_insert_admin" on public.companies
  for insert to authenticated with check (public.is_admin() and org_id = public.current_org_id());

drop policy "companies_update_admin" on public.companies;
create policy "companies_update_admin" on public.companies
  for update to authenticated
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());

drop policy "companies_delete_admin" on public.companies;
create policy "companies_delete_admin" on public.companies
  for delete to authenticated using (public.is_admin() and org_id = public.current_org_id());

-- ---------- contacts ----------
drop policy "contacts_select_auth" on public.contacts;
create policy "contacts_select_org" on public.contacts
  for select to authenticated using (org_id = public.current_org_id());

drop policy "contacts_insert_admin" on public.contacts;
create policy "contacts_insert_admin" on public.contacts
  for insert to authenticated with check (public.is_admin() and org_id = public.current_org_id());

drop policy "contacts_update_admin" on public.contacts;
create policy "contacts_update_admin" on public.contacts
  for update to authenticated
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());

drop policy "contacts_delete_admin" on public.contacts;
create policy "contacts_delete_admin" on public.contacts
  for delete to authenticated using (public.is_admin() and org_id = public.current_org_id());

-- ---------- projects ----------
drop policy "projects_select_auth" on public.projects;
create policy "projects_select_org" on public.projects
  for select to authenticated using (org_id = public.current_org_id());

drop policy "projects_insert_admin" on public.projects;
create policy "projects_insert_admin" on public.projects
  for insert to authenticated with check (public.is_admin() and org_id = public.current_org_id());

drop policy "projects_update_admin" on public.projects;
create policy "projects_update_admin" on public.projects
  for update to authenticated
  using (public.is_admin() and org_id = public.current_org_id())
  with check (public.is_admin() and org_id = public.current_org_id());

drop policy "projects_delete_admin" on public.projects;
create policy "projects_delete_admin" on public.projects
  for delete to authenticated using (public.is_admin() and org_id = public.current_org_id());

-- ---------- project_contacts (no direct org_id — derive via projects) ----------
drop policy "project_contacts_select_auth" on public.project_contacts;
create policy "project_contacts_select_org" on public.project_contacts
  for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_contacts.project_id and p.org_id = public.current_org_id()
    )
  );

drop policy "project_contacts_insert_admin" on public.project_contacts;
create policy "project_contacts_insert_admin" on public.project_contacts
  for insert to authenticated with check (
    public.is_admin() and exists (
      select 1 from public.projects p
      where p.id = project_contacts.project_id and p.org_id = public.current_org_id()
    )
  );

drop policy "project_contacts_delete_admin" on public.project_contacts;
create policy "project_contacts_delete_admin" on public.project_contacts
  for delete to authenticated using (
    public.is_admin() and exists (
      select 1 from public.projects p
      where p.id = project_contacts.project_id and p.org_id = public.current_org_id()
    )
  );

-- ---------- activity_log (APPEND-ONLY — still no update/delete policy) ----------
drop policy "activity_select_auth" on public.activity_log;
create policy "activity_select_org" on public.activity_log
  for select to authenticated using (org_id = public.current_org_id());

drop policy "activity_insert_admin" on public.activity_log;
create policy "activity_insert_admin" on public.activity_log
  for insert to authenticated
  with check (public.is_admin() and author_id = auth.uid() and org_id = public.current_org_id());
