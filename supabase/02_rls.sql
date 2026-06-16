-- ============================================================
-- Odigo CRM — Row-Level Security (02)
--
-- Model:
--   * Every authenticated user can READ all CRM data.
--   * Only users with role = 'admin' can INSERT / UPDATE / DELETE.
--   * activity_log is APPEND-ONLY for everyone — there are deliberately
--     NO update or delete policies, so those operations are blocked at
--     the database layer for all roles, including admins.
--
-- Access control is enforced here at the DB layer, NOT in the UI.
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.companies        enable row level security;
alter table public.contacts         enable row level security;
alter table public.projects         enable row level security;
alter table public.project_contacts enable row level security;
alter table public.activity_log     enable row level security;

-- ---------- profiles ----------
create policy "profiles_select_auth" on public.profiles
  for select to authenticated using (true);
-- Only admins can update profiles (including role assignment).
-- Allowing self-update with a role field in the check is a privilege escalation vector
-- because the WITH CHECK sees the new row — a viewer could set their own role to admin.
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- companies ----------
create policy "companies_select_auth" on public.companies
  for select to authenticated using (true);
create policy "companies_insert_admin" on public.companies
  for insert to authenticated with check (public.is_admin());
create policy "companies_update_admin" on public.companies
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "companies_delete_admin" on public.companies
  for delete to authenticated using (public.is_admin());

-- ---------- contacts ----------
create policy "contacts_select_auth" on public.contacts
  for select to authenticated using (true);
create policy "contacts_insert_admin" on public.contacts
  for insert to authenticated with check (public.is_admin());
create policy "contacts_update_admin" on public.contacts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contacts_delete_admin" on public.contacts
  for delete to authenticated using (public.is_admin());

-- ---------- projects ----------
create policy "projects_select_auth" on public.projects
  for select to authenticated using (true);
create policy "projects_insert_admin" on public.projects
  for insert to authenticated with check (public.is_admin());
create policy "projects_update_admin" on public.projects
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "projects_delete_admin" on public.projects
  for delete to authenticated using (public.is_admin());

-- ---------- project_contacts ----------
create policy "project_contacts_select_auth" on public.project_contacts
  for select to authenticated using (true);
create policy "project_contacts_insert_admin" on public.project_contacts
  for insert to authenticated with check (public.is_admin());
create policy "project_contacts_delete_admin" on public.project_contacts
  for delete to authenticated using (public.is_admin());

-- ---------- activity_log (APPEND-ONLY) ----------
create policy "activity_select_auth" on public.activity_log
  for select to authenticated using (true);
create policy "activity_insert_admin" on public.activity_log
  for insert to authenticated
  with check (public.is_admin() and author_id = auth.uid());
-- NO update/delete policies => append-only enforced at the DB layer.
