-- ============================================================
-- Odigo CRM — RLS for org tables (15)
-- Depends on: 14_organizations.sql
-- ============================================================

-- Helper: is current user a super admin?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: returns the org_id of the calling user
create or replace function public.my_org_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- ---------- organizations ----------
alter table public.organizations enable row level security;

create policy "orgs_select_auth" on public.organizations
  for select to authenticated using (true);

create policy "orgs_insert_super" on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

create policy "orgs_update_super" on public.organizations
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "orgs_delete_super" on public.organizations
  for delete to authenticated
  using (public.is_super_admin());

-- ---------- org_roles ----------
alter table public.org_roles enable row level security;

create policy "org_roles_select_own" on public.org_roles
  for select to authenticated
  using (org_id = public.my_org_id() or public.is_super_admin());

create policy "org_roles_insert_admin" on public.org_roles
  for insert to authenticated
  with check (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

create policy "org_roles_update_admin" on public.org_roles
  for update to authenticated
  using (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  )
  with check (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

create policy "org_roles_delete_admin" on public.org_roles
  for delete to authenticated
  using (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

-- ---------- role_permissions ----------
alter table public.role_permissions enable row level security;

create policy "role_perms_select_own" on public.role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.org_roles r
      where r.id = role_id
        and (r.org_id = public.my_org_id() or public.is_super_admin())
    )
  );

create policy "role_perms_write_admin" on public.role_permissions
  for all to authenticated
  using (
    exists (
      select 1 from public.org_roles r
      where r.id = role_id
        and (
          (r.org_id = public.my_org_id() and public.is_admin())
          or public.is_super_admin()
        )
    )
  )
  with check (
    exists (
      select 1 from public.org_roles r
      where r.id = role_id
        and (
          (r.org_id = public.my_org_id() and public.is_admin())
          or public.is_super_admin()
        )
    )
  );

-- ---------- invitations ----------
alter table public.invitations enable row level security;

create policy "invitations_select_admin" on public.invitations
  for select to authenticated
  using (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

create policy "invitations_insert_admin" on public.invitations
  for insert to authenticated
  with check (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

create policy "invitations_delete_admin" on public.invitations
  for delete to authenticated
  using (
    (org_id = public.my_org_id() and public.is_admin())
    or public.is_super_admin()
  );

-- ---------- Update profiles RLS to expose org cols ----------
-- Super admins can update any profile (for org assignment).
-- The existing policy only covers own-org admins.
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());
