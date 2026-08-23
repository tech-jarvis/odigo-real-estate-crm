-- ============================================================
-- Odigo CRM — stop defaulting new signups into a phantom org (23)
--
-- handle_new_user() still carried feature/d0-multi-org-foundation's
-- hardcoded org_id ('0794fb70-...', "Odigo SMB") on every new profile.
-- Nothing reads profiles.org_id for access control anymore (org
-- membership lives in org_members) so this wasn't an active bug, just
-- confusing residue — every brand-new signup silently got tagged with
-- an org they were never actually a member of.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer'
  );
  return new;
end;
$$;
