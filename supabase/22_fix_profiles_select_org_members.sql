-- ============================================================
-- Odigo CRM — fix profiles_select to use org_members (22)
--
-- A separate branch (feature/d0-multi-org-foundation) applied its
-- own org-scoping directly to this live database, replacing the
-- original permissive "profiles_select_auth" (using (true)) with:
--
--   profiles_select: (id = auth.uid()) OR is_super_admin()
--                     OR (org_id = current_org_id())
--
-- That checks profiles.org_id — the legacy single-org scalar this
-- branch's org_members-based model no longer writes to. Any user
-- whose org_id is stale (never updated after switching/accepting a
-- second org) becomes invisible to their own org's admins: the
-- embedded profiles join in listMembers() comes back null and
-- crashes. Concretely: Sarah accepted a pending invite into BATMAN
-- via org_members, but her profiles.org_id still pointed elsewhere,
-- so Batman couldn't see her in his member list.
--
-- Fix: check org_members (this branch's actual source of truth for
-- "is this profile a member of my current org") instead of the
-- stale scalar. id = auth.uid() and is_super_admin() are unchanged.
-- ============================================================

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_auth" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.org_members m
      where m.user_id = profiles.id
        and m.org_id = public.current_org_id()
        and m.status = 'active'
    )
  );
