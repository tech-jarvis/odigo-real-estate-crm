-- ============================================================
-- Odigo CRM — Organizations + Multi-org Roles (14)
-- Adds: organizations, org_roles, role_permissions, invitations
--       and extends profiles with org_id, is_super_admin,
--       org_role_id columns.
-- ============================================================

-- ---------- Organizations ----------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- Extend profiles ----------
alter table public.profiles
  add column if not exists org_id        uuid,
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists org_role_id   uuid;

alter table public.profiles
  add constraint profiles_org_id_fk
  foreign key (org_id) references public.organizations(id) on delete set null;

-- ---------- Custom org roles ----------
create table public.org_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique(org_id, name)
);

alter table public.profiles
  add constraint profiles_org_role_id_fk
  foreign key (org_role_id) references public.org_roles(id) on delete set null;

-- ---------- Granular permissions ----------
create type public.permission_key as enum (
  'view_projects',    'create_projects',  'edit_projects',   'delete_projects',
  'view_companies',   'create_companies', 'edit_companies',  'delete_companies',
  'view_contacts',    'create_contacts',  'edit_contacts',   'delete_contacts',
  'view_activity',    'manage_members',   'manage_roles'
);

create table public.role_permissions (
  role_id    uuid not null references public.org_roles(id) on delete cascade,
  permission public.permission_key not null,
  primary key (role_id, permission)
);

-- ---------- Invitations ----------
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  crm_role    public.user_role not null default 'viewer',
  org_role_id uuid references public.org_roles(id) on delete set null,
  invited_by  uuid references public.profiles(id) on delete set null,
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index idx_organizations_slug    on public.organizations(slug);
create index idx_profiles_org         on public.profiles(org_id);
create index idx_profiles_super_admin on public.profiles(is_super_admin) where is_super_admin = true;
create index idx_org_roles_org        on public.org_roles(org_id);
create index idx_role_perms_role      on public.role_permissions(role_id);
create index idx_invitations_org      on public.invitations(org_id);
create index idx_invitations_token    on public.invitations(token);
create index idx_invitations_email    on public.invitations(email);
