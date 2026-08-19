-- ============================================================
-- Odigo CRM — Multi-org membership (18)
-- Adds org_members: a many-to-many join between profiles and
-- organizations, replacing the single-org assumption baked into
-- profiles.org_id/org_role_id/role. A person can now hold an
-- active membership (with its own role) in more than one org.
--
-- profiles.org_id / org_role_id / role are NOT dropped here —
-- they stay in place as a transitional "current org" mirror,
-- kept in sync by application code (see acceptInvitation /
-- switchOrg / removeMember), and are only dropped in a later
-- migration once no code path reads them anymore.
-- ============================================================

create type public.org_member_status as enum ('pending', 'active', 'revoked');

create table public.org_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  role        public.user_role not null default 'viewer',
  org_role_id uuid references public.org_roles(id) on delete set null,
  status      public.org_member_status not null default 'active',
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, org_id)
);

create index idx_org_members_user           on public.org_members(user_id);
create index idx_org_members_user_active    on public.org_members(user_id) where status = 'active';
create index idx_org_members_org            on public.org_members(org_id);
create index idx_org_members_user_status    on public.org_members(user_id, status);

create trigger trg_org_members_updated before update on public.org_members
  for each row execute function public.set_updated_at();

-- ---------- profiles: current-org pointer ----------
alter table public.profiles
  add column if not exists last_active_org_id uuid references public.organizations(id) on delete set null;

-- ---------- profiles: fold in must_change_password drift ----------
-- Column already exists in database.types.ts / app code, but was never
-- added by a checked-in migration. Adding it here idempotently.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- ---------- invitations: decline support ----------
-- Distinct from cancelled_at (admin-cancelled) — this records the
-- invitee explicitly declining, so admins can tell the two apart.
alter table public.invitations
  add column if not exists declined_at timestamptz;

-- ---------- Backfill: one org_members row per existing single-org profile ----------
insert into public.org_members (user_id, org_id, role, org_role_id, status)
select id, org_id, role, org_role_id, 'active'
from public.profiles
where org_id is not null
on conflict (user_id, org_id) do nothing;

update public.profiles
set last_active_org_id = org_id
where org_id is not null and last_active_org_id is null;
