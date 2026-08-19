-- ============================================================
-- Odigo CRM — RLS for multi-org membership (19)
-- Depends on: 18_org_members.sql
--
-- Rewrites is_admin()/my_org_id() to be sourced from org_members
-- instead of the single-org profiles.org_id/role scalars, so a
-- user's admin/viewer role now reflects their CURRENT org
-- (profiles.last_active_org_id), not a global flag.
--
-- Note: is_admin() also gates write policies on companies/
-- projects/contacts/project_contacts/activity_log (02_rls.sql).
-- Those tables have no org_id column at all today (tracked
-- separately) — but because is_admin() becomes current-org-aware
-- here, admin write access to those tables will now incidentally
-- depend on which org the caller is currently switched into.
-- ============================================================

-- Helper: the org_id the calling user is currently acting in,
-- validated against an active org_members row (not just the
-- profiles pointer, in case it's stale/revoked).
create or replace function public.current_org_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select p.last_active_org_id
  from public.profiles p
  join public.org_members m
    on m.org_id = p.last_active_org_id
   and m.user_id = p.id
   and m.status = 'active'
  where p.id = auth.uid();
$$;

-- Superseded by current_org_id(); kept only so any stale cached
-- callers don't hard-fail during rollout. Remove once migration 20
-- drops profiles.org_id.
create or replace function public.my_org_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select public.current_org_id();
$$;

-- Role is now per-membership: admin in current org, not a global flag.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.user_id = auth.uid()
      and m.org_id = public.current_org_id()
      and m.role = 'admin'
      and m.status = 'active'
  );
$$;

-- ---------- org_members ----------
alter table public.org_members enable row level security;

-- Everyone can see their own memberships (needed to populate the
-- org switcher / pending-invite list), regardless of current org.
-- Org admins can additionally see all members of their current org.
create policy "org_members_select_own_or_admin" on public.org_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or (org_id = public.current_org_id() and public.is_admin())
    or public.is_super_admin()
  );

-- Defense in depth — the app writes org_members via the service-role
-- admin client (bypasses RLS), same pattern as invitations/org_roles.
create policy "org_members_admin_write" on public.org_members
  for all to authenticated
  using (
    (org_id = public.current_org_id() and public.is_admin())
    or public.is_super_admin()
  )
  with check (
    (org_id = public.current_org_id() and public.is_admin())
    or public.is_super_admin()
  );

-- ---------- org_roles / role_permissions / invitations ----------
-- Policy bodies already reference my_org_id(), which now resolves to
-- current_org_id() (see redefinition above) — no policy DDL changes
-- needed for those three tables.
