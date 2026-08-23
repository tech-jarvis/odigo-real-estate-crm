-- ============================================================
-- Odigo CRM — switch_org RPC (21)
-- Collapses the org-switch check-then-update into a single
-- round-trip (previously two separate queries from the admin
-- client: a SELECT to verify membership, then an UPDATE).
-- ============================================================

create or replace function public.switch_org(p_org_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from public.org_members
    where user_id = auth.uid() and org_id = p_org_id and status = 'active'
  ) then
    raise exception 'You are not an active member of that organization';
  end if;

  update public.profiles set last_active_org_id = p_org_id where id = auth.uid();
end;
$$;

revoke execute on function public.switch_org(uuid) from anon, public;
grant  execute on function public.switch_org(uuid) to authenticated;
