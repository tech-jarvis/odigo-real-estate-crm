-- ============================================================
-- Odigo CRM — Schema (01)
-- Run order: 01_schema.sql → 02_rls.sql → 03_seed.sql
-- Normalised relational model for a construction-firm CRM.
-- ============================================================

-- ---------- Enums ----------
create type public.user_role       as enum ('admin', 'viewer');
create type public.project_stage   as enum ('lead', 'proposal', 'active', 'completed');
create type public.company_segment as enum ('residential', 'commercial', 'industrial');
create type public.activity_type   as enum ('note', 'status_change', 'file_reference', 'call_summary');

-- ---------- Profiles (1:1 with auth.users) ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- ---------- Companies ----------
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  segment         public.company_segment not null,
  address         text,
  primary_contact text,
  phone           text,
  email           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Contacts (many per company) ----------
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  role       text,
  phone      text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Projects ----------
create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  company_id         uuid references public.companies(id) on delete set null,
  stage              public.project_stage not null default 'lead',
  start_date         date,
  estimated_end_date date,
  project_value      numeric(14,2) not null default 0,
  assigned_to        uuid references public.profiles(id) on delete set null,
  status_note        text,
  archived           boolean not null default false,
  -- Soft delete: null = active, non-null = deleted. Permanent removal runs after 15 days.
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- Project <-> Contact (many-to-many) ----------
create table public.project_contacts (
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, contact_id)
);

-- ---------- Activity Log (append-only) ----------
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  type        public.activity_type not null default 'note',
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index idx_contacts_company         on public.contacts(company_id);
create index idx_projects_company         on public.projects(company_id);
create index idx_projects_stage           on public.projects(stage);
create index idx_projects_assigned        on public.projects(assigned_to);
create index idx_projects_deleted_at      on public.projects(deleted_at) where deleted_at is not null;
create index idx_project_contacts_contact on public.project_contacts(contact_id);
create index idx_activity_project          on public.activity_log(project_id);
create index idx_activity_created          on public.activity_log(created_at desc);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------- Auto-create profile on signup ----------
-- Always assigns 'viewer' — role must be elevated by an admin in the profiles table.
-- Never trust user-supplied metadata for role assignment (privilege escalation prevention).
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper: is current user admin? ----------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Lock down internal helpers from the public REST RPC surface.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_admin()        from anon, public;
grant  execute on function public.is_admin()        to authenticated;
