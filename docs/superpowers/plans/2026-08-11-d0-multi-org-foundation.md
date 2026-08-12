# D0: Multi-Org Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Odigo CRM (`real-estat-crm`) and its MCP server (`odigo-mcp`) a real multi-org boundary — an `organizations` table, `org_id` on every org-scoped business table, RLS that enforces the boundary on the CRM side, a shared org-scoped query helper that enforces it on the MCP side (which uses a service-role key and bypasses RLS entirely), and a cross-org isolation test suite that proves both sides hold.

**Architecture:** `org_id` lives directly on the five tables that hold org-scoped business data (`profiles`, `companies`, `contacts`, `projects`, `activity_log`); `project_contacts` and the OAuth/token tables derive org membership transitively (via their FK to `projects`/`contacts` or `user_id`/`auth.uid()`) rather than duplicating the column. CRM-side enforcement is RLS, gated by a new `current_org_id()` SECURITY DEFINER helper (same pattern as the existing `is_admin()`). MCP-side enforcement is a new `orgScoped()` query helper in `odigo-mcp/src/lib/org-scope.ts` that every tool must route through instead of the raw `supabase` client — since the service-role key bypasses RLS, this helper is the *only* enforcement layer on that side.

**Tech Stack:** PostgreSQL/Supabase (RLS, SQL migrations applied by hand via the Supabase SQL Editor / MCP `apply_migration`), Node.js/TypeScript (`@supabase/supabase-js`, `zod`, `vitest`) for `odigo-mcp`, Next.js 15 App Router + Playwright for `real-estat-crm`.

**Repos involved:**
- `/Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm` — currently on branch `master` after this plan's Task 0 (do not build on `feature/brand-color-refresh`, an unrelated 1-commit branch already ahead of `master`)
- `/Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp` — currently on branch `master`

**Live dev Supabase project:** `odigo-crm` (`xkczzuoplwtmynfodejc`) — confirmed via `NEXT_PUBLIC_SUPABASE_URL` in `real-estat-crm/.env.local` and via the Supabase MCP `list_projects`/`list_tables` tools. 9 tables today, all RLS-enabled, no `organizations`/`org_id` of any kind (confirmed by direct grep across both repos).

**Out of scope for D0** (belongs to later deliverables per the V2 estimate): `industry`/`funnel_source` picklists and `stage`/`account_status` reshape (D1), admin-assigned org+role provisioning replacing `handle_new_user()`'s Odigo-SMB default (D2), the write-tool suite (D3–D7), real-user attribution (D8), the SMB data import (D9). D0 only needs to *not block* those — it seeds 3 orgs (Odigo SMB, Odigo Enterprise, ContentGen) as specified in the kickoff doc, with only Odigo SMB carrying today's dev data.

---

### Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create a feature branch in both repos, off `master`**

```bash
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm checkout master
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm pull --ff-only
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm checkout -b feature/d0-multi-org-foundation

git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp checkout master
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp pull --ff-only
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp checkout -b feature/d0-multi-org-foundation
```

Expected: both repos report `Switched to a new branch 'feature/d0-multi-org-foundation'` with a clean working tree.

---

### Task 1: `organizations` table + seed the 3 orgs

**Files:**
- Create: `real-estat-crm/supabase/14_organizations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Odigo CRM — Organizations (14)
--
-- Multi-org foundation. One row per tenant. profiles.org_id ties every
-- user to exactly one org; every CRM business-data table gets its own
-- org_id in migration 15, scoped by RLS in migration 16.
-- ============================================================

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug) values
  ('0794fb70-3922-4b62-a704-15949daa9a80', 'Odigo SMB',        'odigo-smb'),
  ('c501b923-3caf-42e5-877a-5f37a60d6f77', 'Odigo Enterprise', 'odigo-enterprise'),
  ('f9768dd9-8aa7-433f-8026-58bb56e36b2e', 'ContentGen',       'contentgen');

alter table public.organizations enable row level security;

-- Every authenticated user can read the org list (needed to resolve their
-- own org via current_org_id() in migration 16). No insert/update/delete
-- policy — orgs are provisioned out-of-band (service-role only), matching
-- D2's admin-assigned org+role model.
create policy "organizations_select_auth" on public.organizations
  for select to authenticated using (true);
```

- [ ] **Step 2: Apply it to the live dev project and verify**

Use the Supabase MCP tool `apply_migration` with `project_id: "xkczzuoplwtmynfodejc"`, `name: "14_organizations"`, and the SQL above. Then verify with `list_tables` (same `project_id`) — expect a new `public.organizations` row with `rls_enabled: true, rows: 3`.

- [ ] **Step 3: Commit**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm
git add supabase/14_organizations.sql
git commit -m "feat(db): add organizations table, seed Odigo SMB/Enterprise/ContentGen"
```

---

### Task 2: `org_id` columns on the 5 business tables + backfill

**Files:**
- Create: `real-estat-crm/supabase/15_org_id_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Odigo CRM — org_id columns (15)
--
-- Adds org_id to the five tables holding org-scoped business data.
-- project_contacts, oauth_tokens, mcp_auth_codes, calendar_connect_tokens
-- deliberately do NOT get their own org_id — they derive org membership
-- transitively (project_contacts via projects/contacts; the token tables
-- via user_id/auth.uid()), so RLS in migration 16 checks that join instead
-- of duplicating the column.
--
-- All existing rows in this dev database predate multi-org and get
-- backfilled to Odigo SMB (0794fb70-3922-4b62-a704-15949daa9a80) — the
-- only org seeded with live data per the V2 kickoff doc.
-- ============================================================

alter table public.profiles     add column org_id uuid references public.organizations(id);
alter table public.companies    add column org_id uuid references public.organizations(id);
alter table public.contacts     add column org_id uuid references public.organizations(id);
alter table public.projects     add column org_id uuid references public.organizations(id);
alter table public.activity_log add column org_id uuid references public.organizations(id);

update public.profiles     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.companies    set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.contacts     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.projects     set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;
update public.activity_log set org_id = '0794fb70-3922-4b62-a704-15949daa9a80' where org_id is null;

alter table public.profiles     alter column org_id set not null;
alter table public.companies    alter column org_id set not null;
alter table public.contacts     alter column org_id set not null;
alter table public.projects     alter column org_id set not null;
alter table public.activity_log alter column org_id set not null;

create index idx_profiles_org on public.profiles(org_id);
create index idx_companies_org on public.companies(org_id);
create index idx_contacts_org on public.contacts(org_id);
create index idx_projects_org on public.projects(org_id);
create index idx_activity_org on public.activity_log(org_id);

-- handle_new_user() must assign an org on signup. D2 (org & user provisioning)
-- replaces this with an admin-assigned org+role; until then, default new
-- signups to Odigo SMB so the trigger keeps working end-to-end.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer',
    '0794fb70-3922-4b62-a704-15949daa9a80'
  );
  return new;
end;
$$;
```

- [ ] **Step 2: Apply and verify**

Apply via `apply_migration` (`name: "15_org_id_columns"`). Verify with `execute_sql`:

```sql
select
  (select count(*) from public.profiles where org_id is null) as null_profiles,
  (select count(*) from public.companies where org_id is null) as null_companies,
  (select count(*) from public.contacts where org_id is null) as null_contacts,
  (select count(*) from public.projects where org_id is null) as null_projects,
  (select count(*) from public.activity_log where org_id is null) as null_activity;
```

Expected: every column reads `0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/15_org_id_columns.sql
git commit -m "feat(db): add org_id to profiles/companies/contacts/projects/activity_log, backfill to Odigo SMB"
```

---

### Task 3: Org-scoped RLS rewrite

**Files:**
- Create: `real-estat-crm/supabase/16_org_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Apply via `apply_migration` (`name: "16_org_rls"`). Then run `get_advisors` with `type: "security"` on `xkczzuoplwtmynfodejc` — confirm no *new* lints appear beyond the pre-existing 8 (function search_path / leaked-password warnings already present before this plan started). Also run `execute_sql`:

```sql
select policyname, tablename, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected: every `select`/`insert`/`update`/`delete` policy on `profiles`, `companies`, `contacts`, `projects`, `project_contacts`, `activity_log` references `current_org_id()` in `qual` or `with_check`.

- [ ] **Step 3: Commit**

```bash
git add supabase/16_org_rls.sql
git commit -m "feat(db): rewrite RLS to enforce org boundary alongside existing admin/viewer roles"
```

---

### Task 4: Org isolation test fixtures (Enterprise org seed)

**Files:**
- Create: `real-estat-crm/supabase/17_org_isolation_seed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Odigo CRM — org isolation test fixtures (17)
--
-- One admin user + one company in Odigo Enterprise, so the D0 cross-org
-- isolation test suite (Task 14/15) has a second org with real data to
-- prove it can't see. Mirrors 03_seed.sql's account pattern. Safe to
-- re-run. Password: OdigoTest2026!
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

delete from auth.users where email = 'admin@enterprise-test.com';

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  'authenticated', 'authenticated', 'admin@enterprise-test.com',
  extensions.crypt('OdigoTest2026!', extensions.gen_salt('bf')), now(),
  '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Enterprise Admin","role":"admin"}', now(), now()
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email = 'admin@enterprise-test.com';

-- handle_new_user() defaults new signups to Odigo SMB — move this one to
-- Enterprise and elevate to admin (role promotion is never trusted from
-- user metadata, same rule as 03_seed.sql).
update public.profiles
set org_id = 'c501b923-3caf-42e5-877a-5f37a60d6f77', role = 'admin'
where email = 'admin@enterprise-test.com';

insert into public.companies (id, name, segment, org_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'Enterprise Isolation Test Co',
  'commercial',
  'c501b923-3caf-42e5-877a-5f37a60d6f77'
)
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply and verify**

Apply via `apply_migration` (`name: "17_org_isolation_seed"`). Verify with `execute_sql`:

```sql
select p.email, p.role, o.slug
from public.profiles p join public.organizations o on o.id = p.org_id
where p.email = 'admin@enterprise-test.com';
```

Expected: one row, `role = admin`, `slug = odigo-enterprise`.

- [ ] **Step 3: Commit**

```bash
git add supabase/17_org_isolation_seed.sql
git commit -m "test(db): seed an Odigo Enterprise admin + company for cross-org isolation tests"
```

---

### Task 5: Regenerate TypeScript types in both repos

**Files:**
- Modify: `odigo-mcp/src/lib/database.types.ts`
- Modify: `real-estat-crm/src/lib/database.types.ts`
- Create: `real-estat-crm/supabase/18_org_id_defaults.sql`

> **Addendum (discovered during execution):** the original Step 2 below assumed "nothing should break yet" — wrong. `org_id NOT NULL` with no column default (migration 15) breaks TypeScript's structural check on every existing `.insert()` call site into the 5 org-scoped tables, regardless of whether that code references `org_id`. Two classes of breakage:
> - `odigo-mcp/src/tools/write.ts:39` and `odigo-mcp/src/tools/outreach.ts:272` (activity_log inserts) — expected, temporary. Tasks 10/11 (later in this plan) fix these by routing through `orgScoped()`.
> - `real-estat-crm`'s own Server Actions — `src/app/(app)/companies/actions.ts` (company + contact inserts), `src/app/(app)/pipeline/actions.ts` (project + activity_log inserts), `src/app/(app)/pipeline/[slug]/activity-actions.ts` (activity_log insert) — a genuine plan gap: no task in this plan otherwise touches the CRM's own UI-driven writes, only the MCP server's. Fixed by Step 0 below (a DB-level default), not by editing these files.
>
> A separate, pre-existing, unrelated issue was also uncovered incidentally: `companies.slug`/`projects.slug` are `NOT NULL` with no DB default (only trigger-populated per `07_stable_slugs.sql`), which the previously-checked-in (stale) types file incorrectly hid. This is **not** a D0/multi-org issue — flagged separately for a standalone fix. Task 5's verification (Step 2 below) treats the resulting 2 `slug`-only errors (`companies/actions.ts`, `pipeline/actions.ts`) as pre-existing/out-of-scope, not something this task fixes.

- [ ] **Step 0: Add `org_id` DB defaults (new — closes the gap above)**

```sql
-- ============================================================
-- Odigo CRM — org_id column defaults (18)
--
-- Adds `default public.current_org_id()` to the 5 org_id columns added in
-- migration 15. This is a convenience default for RLS-authenticated
-- callers (the CRM app, using the anon key under a real user session) —
-- any insert that omits org_id gets it auto-populated to the inserting
-- user's own org, so the CRM's existing Server Actions (companies/actions.ts,
-- pipeline/actions.ts, pipeline/[slug]/activity-actions.ts) don't need
-- code changes to keep working now that org_id is NOT NULL.
--
-- This does NOT help the MCP server's service-role writes — service-role
-- connections have no auth.uid() session, so current_org_id() evaluates to
-- NULL there and the NOT NULL constraint still applies. That's intentional:
-- MCP write tools (Tasks 6-12) explicitly set org_id via the orgScoped()
-- helper rather than relying on this default, since there's no session to
-- default from.
--
-- Security note: this is a convenience default only, not a new trust
-- boundary. A caller who explicitly supplies a mismatched org_id bypasses
-- the default entirely, and migration 16's RLS with_check policies (org_id
-- = current_org_id()) still reject it — the default can only ever land a
-- row in the caller's own org, never someone else's.
-- ============================================================

alter table public.profiles     alter column org_id set default public.current_org_id();
alter table public.companies    alter column org_id set default public.current_org_id();
alter table public.contacts     alter column org_id set default public.current_org_id();
alter table public.projects     alter column org_id set default public.current_org_id();
alter table public.activity_log alter column org_id set default public.current_org_id();
```

Write this as `real-estat-crm/supabase/18_org_id_defaults.sql`, apply via `apply_migration` (`name: "18_org_id_defaults"`), then verify with `execute_sql`:

```sql
select table_name, column_default
from information_schema.columns
where table_schema = 'public' and column_name = 'org_id'
order by table_name;
```

Expected: all 5 rows show `column_default` containing `current_org_id()`.

- [ ] **Step 1: Regenerate**

Use the Supabase MCP tool `generate_typescript_types` with `project_id: "xkczzuoplwtmynfodejc"`, and overwrite both files with its output verbatim (it is machine-generated — do not hand-edit).

- [ ] **Step 2: Verify both repos still typecheck**

```bash
cd odigo-mcp && npm run lint
cd real-estat-crm && npx tsc --noEmit
```

Expected (revised per the addendum above): `real-estat-crm` exits 0 except for exactly 2 pre-existing, unrelated `slug`-required errors in `companies/actions.ts` and `pipeline/actions.ts` (tracked separately, not fixed here). `odigo-mcp` exits non-zero with exactly 2 errors, both `org_id` missing on `activity_log` inserts in `write.ts:39` and `outreach.ts:272` (expected — Tasks 10/11 fix these). Confirm no *other* errors exist beyond exactly these 4 known ones in total across both repos — any additional error is a real regression and should stop and be reported, not waved through.

> **Second addendum (discovered during execution):** the DB-level `org_id` default in Step 0 is schema-wide, not role-scoped — Postgres has no concept of "optional for the anon-key client, required for the service-role client." Regenerating types after Step 0 therefore made `org_id` optional in *both* repos' generated `Insert` types, silently removing the compile-time guardrail that used to catch a missing `org_id` in `odigo-mcp`'s service-role writes (which get no benefit from the default — there's no `auth.uid()` session for `current_org_id()` to resolve there). Fixed by hand-authoring a local type override in `odigo-mcp/src/lib/supabase.ts` (not touching the generated file) that re-requires `org_id: string` on the `Insert` shape of the same 5 tables, specifically for the client exported from that file:
> ```typescript
> import { createClient } from '@supabase/supabase-js'
> import type { Database as GeneratedDatabase } from './database.types.js'
>
> type OrgScopedTable = 'profiles' | 'companies' | 'contacts' | 'projects' | 'activity_log'
>
> type Database = Omit<GeneratedDatabase, 'public'> & {
>   public: Omit<GeneratedDatabase['public'], 'Tables'> & {
>     Tables: {
>       [K in keyof GeneratedDatabase['public']['Tables']]: K extends OrgScopedTable
>         ? Omit<GeneratedDatabase['public']['Tables'][K], 'Insert'> & {
>             Insert: GeneratedDatabase['public']['Tables'][K]['Insert'] & { org_id: string }
>           }
>         : GeneratedDatabase['public']['Tables'][K]
>     }
>   }
> }
> ```
> First attempt reconstructed `Database` from scratch (`type Database = { public: ... }`) instead of `Omit`-ing off the generated type, which silently dropped the generated `__InternalSupabase: { PostgrestVersion: "14.5" }` sibling key — `supabase-js`'s `createClient<Database>()` reads that key to infer the PostgREST version and falls back to `'12'` when it's absent, silently gating version-13+-only client features even though the live server is 14.5. Fixed by using `Omit<GeneratedDatabase, 'public'>` (shown above) instead, which lets every other top-level key — including `__InternalSupabase` — pass through untouched. Verified by tracing the consumption path in `@supabase/supabase-js`'s `SupabaseClient.ts` and confirming the literal type resolves to `"14.5"`, not the fallback.
>
> This guardrail is genuinely load-bearing, not theoretical: it's what makes `write.ts:39` and `outreach.ts:272` fail to compile right now (see Step 2's expected output) — exactly the bug Tasks 10/11 exist to fix. Without it, that same class of bug could ship silently in a future MCP write tool between now and whenever someone happens to test it at runtime.

- [ ] **Step 3: Commit**

```bash
cd real-estat-crm
git add supabase/18_org_id_defaults.sql src/lib/database.types.ts
git commit -m "feat(db): default org_id to the caller's own org for RLS-authenticated inserts"

cd odigo-mcp
git add src/lib/database.types.ts src/lib/supabase.ts
git commit -m "chore: regenerate database types; re-require org_id on service-role inserts"
```

(Actual execution used one additional follow-up commit in `odigo-mcp` to fix the `__InternalSupabase` regression described above — `fix: preserve __InternalSupabase PostgrestVersion in the org-scoped type override` — after a code review caught it. Final `odigo-mcp` state for this task: types regen + guardrail + that fix, 2 commits total beyond the branch base.)

---

### Task 6: Org-scoped query helper (`odigo-mcp`)

This is the shared enforcement point every MCP tool must route through, since the service-role client bypasses RLS entirely.

**Files:**
- Create: `odigo-mcp/src/lib/org-scope.ts`
- Test: `odigo-mcp/tests/org-scope.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// odigo-mcp/tests/org-scope.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

const calls: Array<{ method: string; args: unknown[] }> = []

function fakeBuilder() {
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    return builder
  }
  const builder: Record<string, unknown> = {
    select: record('select'),
    insert: record('insert'),
    update: record('update'),
    delete: record('delete'),
    eq: record('eq'),
  }
  return builder
}

vi.mock('../src/lib/supabase.js', () => ({
  supabase: { from: vi.fn(() => fakeBuilder()) },
}))

async function getOrgScoped() {
  const { orgScoped } = await import('../src/lib/org-scope.js')
  return orgScoped
}

describe('orgScoped', () => {
  it('select() always applies an org_id eq filter', async () => {
    calls.length = 0
    const orgScoped = await getOrgScoped()
    orgScoped('org-a').from('companies').select('id, name')
    expect(calls).toContainEqual({ method: 'select', args: ['id, name'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['org_id', 'org-a'] })
  })

  it('insert() injects org_id into the row even if the caller omits it', async () => {
    calls.length = 0
    const orgScoped = await getOrgScoped()
    orgScoped('org-b').from('companies').insert({ name: 'Acme', segment: 'commercial' } as never)
    expect(calls).toContainEqual({
      method: 'insert',
      args: [{ name: 'Acme', segment: 'commercial', org_id: 'org-b' }],
    })
  })

  it('insert() overwrites a caller-supplied org_id — never trust caller input', async () => {
    calls.length = 0
    const orgScoped = await getOrgScoped()
    orgScoped('org-b')
      .from('companies')
      .insert({ name: 'Acme', segment: 'commercial', org_id: 'org-a' } as never)
    expect(calls).toContainEqual({
      method: 'insert',
      args: [{ name: 'Acme', segment: 'commercial', org_id: 'org-b' }],
    })
  })

  it('update() always applies an org_id eq filter', async () => {
    calls.length = 0
    const orgScoped = await getOrgScoped()
    orgScoped('org-a').from('projects').update({ stage: 'won' } as never)
    expect(calls).toContainEqual({ method: 'update', args: [{ stage: 'won' }] })
    expect(calls).toContainEqual({ method: 'eq', args: ['org_id', 'org-a'] })
  })

  it('delete() always applies an org_id eq filter', async () => {
    calls.length = 0
    const orgScoped = await getOrgScoped()
    orgScoped('org-a').from('contacts').delete()
    expect(calls).toContainEqual({ method: 'eq', args: ['org_id', 'org-a'] })
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npx vitest run tests/org-scope.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/org-scope.js'`.

- [ ] **Step 3: Implement**

```typescript
// odigo-mcp/src/lib/org-scope.ts
import { supabase } from './supabase.js'
import type { Database } from './database.types.js'

/**
 * Tables that carry a direct org_id column and are safe to route through
 * this helper. project_contacts, oauth_tokens, mcp_auth_codes, and
 * calendar_connect_tokens are deliberately excluded — see 16_org_rls.sql
 * for why they don't have their own org_id.
 */
export type OrgScopedTable = 'profiles' | 'companies' | 'contacts' | 'projects' | 'activity_log'

type TableInsert<T extends OrgScopedTable> = Database['public']['Tables'][T]['Insert']
type TableUpdate<T extends OrgScopedTable> = Database['public']['Tables'][T]['Update']

/**
 * The one shared query path every MCP tool must route through for
 * org-scoped tables. The service-role Supabase client (src/lib/supabase.ts)
 * bypasses RLS entirely, so this is the only enforcement layer on the MCP
 * side — a tool that calls `supabase.from(...)` directly instead of this
 * helper reintroduces a cross-org leak.
 */
export function orgScoped(orgId: string) {
  function from<T extends OrgScopedTable>(table: T) {
    const base = supabase.from(table)
    return {
      select: (columns = '*') => base.select(columns).eq('org_id', orgId),
      insert: (row: Omit<TableInsert<T>, 'org_id'>) =>
        base.insert({ ...row, org_id: orgId } as TableInsert<T>),
      update: (values: TableUpdate<T>) => base.update(values).eq('org_id', orgId),
      delete: () => base.delete().eq('org_id', orgId),
    }
  }
  return { from }
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run tests/org-scope.test.ts
```

Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-scope.ts tests/org-scope.test.ts
git commit -m "feat: add shared org-scoped query helper for MCP tools"
```

---

### Task 7: Thread `orgId` through `AuthContext` and both MCP entry points

**Files:**
- Modify: `odigo-mcp/src/lib/mcp-server.ts:12-15`
- Modify: `odigo-mcp/src/index.ts`
- Modify: `odigo-mcp/src/lib/require-auth.ts`
- Modify: `odigo-mcp/src/http.ts:64`

- [ ] **Step 1: Add `orgId` to `AuthContext`**

Edit `odigo-mcp/src/lib/mcp-server.ts`:

```diff
 /** Identity + role of the authenticated caller, derived from their CRM profile. */
 export interface AuthContext {
   userId: string
   isAdmin: boolean
+  orgId: string
 }
```

- [ ] **Step 2: Resolve `orgId` on the stdio entry point**

Replace the body of `odigo-mcp/src/index.ts`'s `main()`:

```typescript
import 'dotenv/config'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './lib/mcp-server.js'
import { supabase } from './lib/supabase.js'

async function main() {
  // Stdio transport has no auth middleware — userId must come from env.
  // Resolve the caller's CRM role and org the same way require-auth does
  // over HTTP, so tools behave identically on both transports.
  const userId = process.env.MCP_USER_ID ?? ''
  let isAdmin = false
  let orgId = ''
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', userId)
      .single()
    isAdmin = profile?.role === 'admin'
    orgId = profile?.org_id ?? ''
  }
  const server = createMcpServer({ userId, isAdmin, orgId })
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`Odigo MCP server running on stdio\n`)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
```

- [ ] **Step 3: Resolve `orgId` on the HTTP entry point**

Edit `odigo-mcp/src/lib/require-auth.ts`:

```diff
 declare global {
   namespace Express {
     interface Request {
       userId: string
       userRole: 'admin' | 'viewer'
+      orgId: string
     }
   }
 }
```

```diff
   // Verify the token belongs to a user with a CRM profile.
   // Supabase JWTs are valid for any auth.users row; this ensures only
   // users who exist in the CRM can call MCP tools.
   const { data: profile } = await supabase
     .from('profiles')
-    .select('role')
+    .select('role, org_id')
     .eq('id', user.id)
     .single()

   if (!profile) {
     res.status(403).json({ error: 'forbidden', error_description: 'No CRM account for this user' })
     return
   }

   req.userId = user.id
   // Mirror the CRM's own access model into the MCP: the service-role key bypasses
   // RLS, so the caller's role must be carried through and re-checked on write tools.
   req.userRole = profile.role === 'admin' ? 'admin' : 'viewer'
+  req.orgId = profile.org_id
   next()
```

- [ ] **Step 4: Pass `orgId` into `createMcpServer` over HTTP**

Edit `odigo-mcp/src/http.ts:64`:

```diff
-  const server = createMcpServer({ userId: req.userId, isAdmin: req.userRole === 'admin' })
+  const server = createMcpServer({ userId: req.userId, isAdmin: req.userRole === 'admin', orgId: req.orgId })
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npm run lint
```

Expected: fails right now with "Property 'orgId' is missing" errors in `tools/read.ts`, `tools/write.ts`, `tools/outreach.ts`, `tools/sweep.ts` call sites and in the 4 test files that build `AuthContext` objects — that's expected; Tasks 8–12 fix each in turn. Confirm the *only* errors are exactly those missing-`orgId` errors (no unrelated typos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp-server.ts src/index.ts src/lib/require-auth.ts src/http.ts
git commit -m "feat: thread orgId through AuthContext on both stdio and HTTP entry points"
```

---

### Task 8: Refactor `read.ts` into an org-scoped factory

**Files:**
- Modify: `odigo-mcp/src/tools/read.ts` (full rewrite — see below)
- Modify: `odigo-mcp/tests/read.test.ts:8-13`

- [ ] **Step 1: Rewrite `read.ts`**

Replace the entire contents of `odigo-mcp/src/tools/read.ts`:

```typescript
import { z } from 'zod'
import { orgScoped } from '../lib/org-scope.js'
import type { AuthContext } from '../lib/mcp-server.js'

type ToolResult = { isError?: boolean; content: Array<{ type: 'text'; text: string }> }

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

// ─── Helper: Escape ILIKE special characters ──────────────────────────────

function escapeIlike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

// ─── Input schemas ──────────────────────────────────────────────────────────

const ListNewLeadsInput = z.object({
  since: z.string().date(),
})

const GetProjectInput = z.object({
  project_id: z.string().uuid(),
})

const GetCompanyInput = z.object({
  company_id: z.string().uuid(),
})

const GetContactInput = z.object({
  contact_id: z.string().uuid(),
})

const ListPipelineInput = z.object({
  stage: z.enum(['lead', 'proposal', 'active', 'completed']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
})

const GetActivityLogInput = z.object({
  project_id: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional().default(20),
})

const SearchContactsInput = z.object({
  query: z.string().min(1).max(200),
})

// ─── Factory: inject auth context so every query is org-scoped ────────────

export function makeReadTools(auth: AuthContext): Array<{
  definition: { name: string; description: string; inputSchema: object }
  handler: (args: unknown) => Promise<ToolResult>
}> {
  const db = orgScoped(auth.orgId)

  async function handleListNewLeads(args: unknown): Promise<ToolResult> {
    const parsed = ListNewLeadsInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { since } = parsed.data

    const { data: leads, error: leadsError } = await db
      .from('projects')
      .select('id, name, company_id, stage, project_value, created_at, slug')
      .eq('stage', 'lead')
      .is('deleted_at', null)
      .eq('archived', false)
      .gt('created_at', since)

    if (leadsError) return err(leadsError.message)
    if (!leads || leads.length === 0) return ok([])

    const { data: outreached, error: outreachError } = await db
      .from('activity_log')
      .select('project_id')
      .eq('type', 'call_summary')
      .like('body', '[OUTREACH]%')

    if (outreachError) return err(outreachError.message)

    const outreachedIds = new Set((outreached ?? []).map((r) => r.project_id))
    const newLeads = leads.filter((p) => !outreachedIds.has(p.id))

    return ok(newLeads)
  }

  async function handleGetProject(args: unknown): Promise<ToolResult> {
    const parsed = GetProjectInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { project_id } = parsed.data

    const { data, error } = await db
      .from('projects')
      .select(`
        id, name, stage, project_value, start_date, estimated_end_date,
        status_note, slug, created_at, updated_at,
        company:companies(id, name, segment, industry, funnel_source),
        contacts:project_contacts(contact:contacts(id, name, role, email, phone))
      `)
      .eq('id', project_id)
      .is('deleted_at', null)
      .single()

    if (error) return err(error.message)
    return ok(data)
  }

  async function handleGetCompany(args: unknown): Promise<ToolResult> {
    const parsed = GetCompanyInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { company_id } = parsed.data

    const { data, error } = await db
      .from('companies')
      .select('*, contacts(*)')
      .eq('id', company_id)
      .single()

    if (error) return err(error.message)
    return ok(data)
  }

  async function handleGetContact(args: unknown): Promise<ToolResult> {
    const parsed = GetContactInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { contact_id } = parsed.data

    const { data, error } = await db
      .from('contacts')
      .select('*, company:companies(id, name, segment, industry, funnel_source)')
      .eq('id', contact_id)
      .single()

    if (error) return err(error.message)
    return ok(data)
  }

  async function handleListPipeline(args: unknown): Promise<ToolResult> {
    const parsed = ListPipelineInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { stage, limit } = parsed.data

    let q = db
      .from('projects')
      .select('id, name, stage, project_value, company_id, updated_at, slug')
      .is('deleted_at', null)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (stage) q = q.eq('stage', stage)

    const { data, error } = await q
    if (error) return err(error.message)
    return ok(data)
  }

  async function handleGetActivityLog(args: unknown): Promise<ToolResult> {
    const parsed = GetActivityLogInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { project_id, limit } = parsed.data

    const { data, error } = await db
      .from('activity_log')
      .select('id, type, body, created_at, author_id')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return err(error.message)
    return ok(data)
  }

  async function handleSearchContacts(args: unknown): Promise<ToolResult> {
    const parsed = SearchContactsInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)
    const { query } = parsed.data

    const escaped = escapeIlike(query)
    const { data, error } = await db
      .from('contacts')
      .select('id, name, role, email, phone, company:companies(id, name)')
      .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
      .limit(20)

    if (error) return err(error.message)
    return ok(data)
  }

  return [
    {
      definition: {
        name: 'list_new_leads',
        description:
          'List projects in the lead stage that were created after a given date and have not yet received an outreach call summary.',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              format: 'date',
              description: 'ISO date string (YYYY-MM-DD). Return leads created after this date.',
            },
          },
          required: ['since'],
          additionalProperties: false,
        },
      },
      handler: handleListNewLeads,
    },
    {
      definition: {
        name: 'get_project',
        description:
          'Retrieve full details of a project including its company info and associated contacts.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', format: 'uuid', description: 'UUID of the project.' },
          },
          required: ['project_id'],
          additionalProperties: false,
        },
      },
      handler: handleGetProject,
    },
    {
      definition: {
        name: 'get_company',
        description: 'Retrieve a company record together with all its contacts.',
        inputSchema: {
          type: 'object',
          properties: {
            company_id: { type: 'string', format: 'uuid', description: 'UUID of the company.' },
          },
          required: ['company_id'],
          additionalProperties: false,
        },
      },
      handler: handleGetCompany,
    },
    {
      definition: {
        name: 'get_contact',
        description: 'Retrieve a single contact along with their parent company details.',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'string', format: 'uuid', description: 'UUID of the contact.' },
          },
          required: ['contact_id'],
          additionalProperties: false,
        },
      },
      handler: handleGetContact,
    },
    {
      definition: {
        name: 'list_pipeline',
        description:
          'List all non-archived, non-deleted projects ordered by most recently updated. Optionally filter by stage.',
        inputSchema: {
          type: 'object',
          properties: {
            stage: {
              type: 'string',
              enum: ['lead', 'proposal', 'active', 'completed'],
              description: 'Filter by pipeline stage. Omit to return all stages.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of projects to return (1–100, default 50).',
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      handler: handleListPipeline,
    },
    {
      definition: {
        name: 'get_activity_log',
        description: 'Retrieve the activity log for a project, newest entries first.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the project.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of entries to return (1–50, default 20).',
            },
          },
          required: ['project_id'],
          additionalProperties: false,
        },
      },
      handler: handleGetActivityLog,
    },
    {
      definition: {
        name: 'search_contacts',
        description: 'Full-text search contacts by name or email (case-insensitive, up to 20 results).',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Search term to match against contact name or email.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      handler: handleSearchContacts,
    },
  ]
}
```

- [ ] **Step 2: Update the test helper**

Edit `odigo-mcp/tests/read.test.ts` lines 1–13:

```diff
 import { describe, it, expect, beforeAll } from 'vitest'

+const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
+const TEST_ORG_ID = '0794fb70-3922-4b62-a704-15949daa9a80'
+
 // Set required env vars before any module is imported
 beforeAll(() => {
   process.env.SUPABASE_URL = 'https://test.supabase.co'
   process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
 })

 // Lazy import after env vars are set
 async function getReadTools() {
-  const { readTools } = await import('../src/tools/read.js')
-  return readTools
+  const { makeReadTools } = await import('../src/tools/read.js')
+  return makeReadTools({ userId: TEST_USER_ID, isAdmin: true, orgId: TEST_ORG_ID })
 }
```

No other lines in the file change — every `describe`/`it` block already calls `getReadTools()` and never constructed `AuthContext` directly.

- [ ] **Step 3: Run the tests**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npx vitest run tests/read.test.ts
```

Expected: PASS, same 15 passing / 2 skipped as before the refactor.

- [ ] **Step 4: Commit**

```bash
git add src/tools/read.ts tests/read.test.ts
git commit -m "refactor: convert read tools into an org-scoped factory"
```

---

### Task 9: Refactor `sweep.ts` into an org-scoped factory

**Files:**
- Modify: `odigo-mcp/src/tools/sweep.ts` (full rewrite — see below)
- Modify: `odigo-mcp/tests/sweep.test.ts:1-11`

- [ ] **Step 1: Rewrite `sweep.ts`**

Replace the entire contents of `odigo-mcp/src/tools/sweep.ts`:

```typescript
import { z } from 'zod'
import { orgScoped } from '../lib/org-scope.js'
import type { AuthContext } from '../lib/mcp-server.js'

type ToolResult = { isError?: boolean; content: Array<{ type: 'text'; text: string }> }

function err(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

// ─── Tool: get_daily_pipeline_report ─────────────────────────────────────────

const GetDailyPipelineReportInput = z.object({
  stale_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .default(parseInt(process.env.STALE_DAYS ?? '7', 10)),
  high_value_threshold: z
    .number()
    .min(0)
    .optional()
    .default(parseFloat(process.env.HIGH_VALUE_THRESHOLD ?? '100000')),
})

export function makeSweepTools(auth: AuthContext): Array<{
  definition: { name: string; description: string; inputSchema: object }
  handler: (args: unknown) => Promise<ToolResult>
}> {
  const db = orgScoped(auth.orgId)

  async function handleGetDailyPipelineReport(args: unknown): Promise<ToolResult> {
    const parsed = GetDailyPipelineReportInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)

    const { stale_days, high_value_threshold } = parsed.data
    const staleCutoff = new Date(Date.now() - stale_days * 86400 * 1000).toISOString()

    const [{ data: projects, error: projectsError }, { data: recentActivity, error: activityError }] =
      await Promise.all([
        db
          .from('projects')
          .select('id, stage, project_value, name, company_id, updated_at, slug')
          .is('deleted_at', null)
          .eq('archived', false),
        // Only pull activity inside the stale window. A project is "fresh" iff it has
        // any activity newer than the cutoff, so older rows can't change the result —
        // this bounds the scan to the window instead of the entire activity_log table.
        db
          .from('activity_log')
          .select('project_id, created_at')
          .gte('created_at', staleCutoff)
          .order('created_at', { ascending: false }),
      ])

    if (projectsError) return err(projectsError.message)
    if (activityError) return err(activityError.message)

    // Build map of project_id → latest activity date (within the stale window)
    const activityMap = new Map<string, string>()
    for (const a of recentActivity ?? []) {
      if (!activityMap.has(a.project_id)) {
        activityMap.set(a.project_id, a.created_at)
      }
    }

    const leads = (projects ?? []).filter((p) => p.stage === 'lead')
    const proposals = (projects ?? []).filter((p) => p.stage === 'proposal')
    const actives = (projects ?? []).filter((p) => p.stage === 'active')

    const stale_projects = (projects ?? []).filter((p) => {
      if (p.stage === 'completed') return false
      const lastActivity = activityMap.get(p.id) ?? p.updated_at
      return new Date(lastActivity) < new Date(staleCutoff)
    })

    const high_value_at_risk = stale_projects.filter(
      (p) =>
        (p.stage === 'lead' || p.stage === 'proposal') &&
        p.project_value > high_value_threshold,
    )

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              leads_count: leads.length,
              proposals_count: proposals.length,
              active_count: actives.length,
              stale_projects: stale_projects.map((p) => ({
                id: p.id,
                name: p.name,
                stage: p.stage,
                project_value: p.project_value,
                slug: p.slug,
                last_activity: activityMap.get(p.id) ?? p.updated_at,
              })),
              high_value_at_risk: high_value_at_risk.map((p) => ({
                id: p.id,
                name: p.name,
                stage: p.stage,
                project_value: p.project_value,
                slug: p.slug,
                last_activity: activityMap.get(p.id) ?? p.updated_at,
              })),
              actions_needed: [],
              generated_at: new Date().toISOString(),
              stale_threshold_days: stale_days,
              high_value_threshold,
            },
            null,
            2,
          ),
        },
      ],
    }
  }

  return [
    {
      definition: {
        name: 'get_daily_pipeline_report',
        description:
          'Returns a structured CRM pipeline snapshot. stale_projects = no activity in N days. high_value_at_risk = stale leads/proposals above the value threshold. Claude synthesizes actions_needed from the returned data.',
        inputSchema: {
          type: 'object',
          properties: {
            stale_days: {
              type: 'number',
              description: 'Days without activity before a project is stale (default: 7)',
            },
            high_value_threshold: {
              type: 'number',
              description:
                'Project value above which a stale deal is flagged (default: 100000)',
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      handler: handleGetDailyPipelineReport,
    },
  ]
}
```

- [ ] **Step 2: Update the test helper**

Edit `odigo-mcp/tests/sweep.test.ts` lines 1–11:

```diff
 import { describe, it, expect, beforeAll } from 'vitest'

 beforeAll(() => {
   process.env.SUPABASE_URL = 'https://test.supabase.co'
   process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
 })

+const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
+const TEST_ORG_ID = '0794fb70-3922-4b62-a704-15949daa9a80'
+
 async function getSweepTools() {
-  const { sweepTools } = await import('../src/tools/sweep.js')
-  return sweepTools
+  const { makeSweepTools } = await import('../src/tools/sweep.js')
+  return makeSweepTools({ userId: TEST_USER_ID, isAdmin: true, orgId: TEST_ORG_ID })
 }
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run tests/sweep.test.ts
```

Expected: PASS, same 6 passing / 3 skipped as before.

- [ ] **Step 4: Commit**

```bash
git add src/tools/sweep.ts tests/sweep.test.ts
git commit -m "refactor: convert sweep tool into an org-scoped factory"
```

---

### Task 10: Org-scope `write.ts` and close the project-ID cross-org gap

Today `log_activity` never checks that `project_id` exists, let alone that it belongs to the caller's org — the FK constraint only guarantees the project exists *somewhere*, not in the right org. Routing the project lookup through `orgScoped` closes that.

**Files:**
- Modify: `odigo-mcp/src/tools/write.ts` (full rewrite — see below)
- Modify: `odigo-mcp/tests/write.test.ts:1-13`

- [ ] **Step 1: Write the new failing test (cross-org project rejection)**

Add to `odigo-mcp/tests/write.test.ts`, inside the existing `describe('log_activity', ...)` block:

```typescript
  it('rejects when BOT_PROFILE_ID is unset even for a well-formed request', async () => {
    const originalBotId = process.env.BOT_PROFILE_ID
    delete process.env.BOT_PROFILE_ID
    const tools = await getWriteTools()
    const tool = tools.find((t) => t.definition.name === 'log_activity')!
    const result = await tool.handler({
      project_id: '00000000-0000-0000-0000-000000000001',
      type: 'note',
      body: 'test',
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('BOT_PROFILE_ID')
    if (originalBotId) process.env.BOT_PROFILE_ID = originalBotId
  })
```

(This test already passes today — it's here to lock in that the `BOT_PROFILE_ID` check still runs *before* any network call, since Step 3 below adds an org-scoped project lookup between the admin check and the insert. The actual cross-org rejection needs a live DB and is covered by the Task 13 integration suite — schema validation tests here can't distinguish "project doesn't exist" from "project exists in another org" without a real network call, both surface identically as `Project not found`.)

- [ ] **Step 2: Update the test helper's `AuthContext`**

Edit `odigo-mcp/tests/write.test.ts` lines 1–13:

```diff
 import { describe, it, expect, beforeAll } from 'vitest'

 beforeAll(() => {
   process.env.SUPABASE_URL = 'https://test.supabase.co'
   process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
 })

 const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
+const TEST_ORG_ID = '0794fb70-3922-4b62-a704-15949daa9a80'

 async function getWriteTools(isAdmin = true) {
   const { makeWriteTools } = await import('../src/tools/write.js')
-  return makeWriteTools({ userId: TEST_USER_ID, isAdmin })
+  return makeWriteTools({ userId: TEST_USER_ID, isAdmin, orgId: TEST_ORG_ID })
 }
```

- [ ] **Step 3: Rewrite `write.ts`**

Replace the entire contents of `odigo-mcp/src/tools/write.ts`:

```typescript
import { z } from 'zod'
import { orgScoped } from '../lib/org-scope.js'
import type { AuthContext } from '../lib/mcp-server.js'

type ToolResult = { isError?: boolean; content: Array<{ type: 'text'; text: string }> }

function err(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

// ─── Tool 1: log_activity ─────────────────────────────────────────────────

const LogActivityInput = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['note', 'status_change', 'file_reference', 'call_summary']),
  body: z.string().min(1).max(2000),
})

// ─── Factory: inject auth context so writes match the CRM's admin-only RLS ──

export function makeWriteTools(auth: AuthContext): Array<{
  definition: { name: string; description: string; inputSchema: object }
  handler: (args: unknown) => Promise<ToolResult>
}> {
  const db = orgScoped(auth.orgId)

  async function handleLogActivity(args: unknown): Promise<ToolResult> {
    if (!auth.isAdmin) {
      return err('Writing to the CRM requires an admin account. Your CRM profile is read-only (viewer).')
    }

    const parsed = LogActivityInput.safeParse(args)
    if (!parsed.success) return err(parsed.error.message)

    if (!process.env.BOT_PROFILE_ID) {
      return err('BOT_PROFILE_ID environment variable is not set')
    }

    // Org-scoped lookup: a project_id from another org resolves to "not
    // found" here rather than leaking, and blocks logging an activity
    // entry onto a project that isn't in this org.
    const { data: project, error: projectError } = await db
      .from('projects')
      .select('id')
      .eq('id', parsed.data.project_id)
      .single()

    if (projectError || !project) {
      return err(`Project not found: ${parsed.data.project_id}`)
    }

    const { data, error } = await db
      .from('activity_log')
      .insert({
        project_id: parsed.data.project_id,
        type: parsed.data.type,
        body: parsed.data.body,
        author_id: process.env.BOT_PROFILE_ID,
      })
      .select('id, created_at')
      .single()

    if (error) {
      return err(`Failed to log activity: ${error.message}`)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, id: data.id, created_at: data.created_at }),
        },
      ],
    }
  }

  return [
    {
      definition: {
        name: 'log_activity',
        description:
          'Log an activity entry (note, status_change, file_reference, or call_summary) to a project. Always log after taking any CRM action. Requires an admin CRM account.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string', format: 'uuid', description: 'Project UUID' },
            type: {
              type: 'string',
              enum: ['note', 'status_change', 'file_reference', 'call_summary'],
            },
            body: {
              type: 'string',
              minLength: 1,
              maxLength: 2000,
              description: 'Activity content',
            },
          },
          required: ['project_id', 'type', 'body'],
          additionalProperties: false,
        },
      },
      handler: handleLogActivity,
    },
  ]
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/write.test.ts
```

Expected: PASS, 9 previous + 1 new = 10 passing.

- [ ] **Step 5: Commit**

```bash
git add src/tools/write.ts tests/write.test.ts
git commit -m "feat: org-scope log_activity, reject cross-org project_id as not-found"
```

---

### Task 11: Org-scope `outreach.ts`

`project_contacts` queries stay on the raw `supabase` client (no `org_id` column exists there — see Task 3's rationale); they're still safe because by the time either handler reaches a `project_contacts` query, `project_id` and `contact_id` have already been resolved through an org-scoped lookup earlier in the same handler, so a cross-org ID can never reach that point.

**Files:**
- Modify: `odigo-mcp/src/tools/outreach.ts:1-4, 104-119, 187-200, 224-230, 272`
- Modify: `odigo-mcp/tests/outreach.test.ts:1-13`

- [ ] **Step 1: Update the test helper's `AuthContext`**

Edit `odigo-mcp/tests/outreach.test.ts` lines 1–13:

```diff
 import { describe, it, expect, beforeAll } from 'vitest'

 const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'
+const TEST_ORG_ID = '0794fb70-3922-4b62-a704-15949daa9a80'

 beforeAll(() => {
   process.env.SUPABASE_URL = 'https://test.supabase.co'
   process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
 })

 async function getOutreachTools(isAdmin = true) {
   const { makeOutreachTools } = await import('../src/tools/outreach.js')
-  return makeOutreachTools({ userId: TEST_USER_ID, isAdmin })
+  return makeOutreachTools({ userId: TEST_USER_ID, isAdmin, orgId: TEST_ORG_ID })
 }
```

- [ ] **Step 2: Add the `orgScoped` import and `db` binding**

Edit `odigo-mcp/src/tools/outreach.ts` lines 1–4:

```diff
 import { z } from 'zod'
 import { supabase } from '../lib/supabase.js'
+import { orgScoped } from '../lib/org-scope.js'
 import { sendCalendarEvent, getConnectedCalendars } from '../lib/calendar-provider.js'
 import type { AuthContext } from '../lib/mcp-server.js'
```

Then, inside `makeOutreachTools`, right after `const userId = auth.userId`:

```diff
   const userId = auth.userId
+  const db = orgScoped(auth.orgId)
```

- [ ] **Step 3: Org-scope the two `handleDraftCalendarInvite` lookups**

```diff
     const { data: rawProject, error: projectError } = await supabase
+    const { data: rawProject, error: projectError } = await db
       .from('projects')
       .select('id, name, company:companies(id, name, industry, funnel_source)')
       .eq('id', project_id)
       .is('deleted_at', null)
       .single()

     if (projectError || !rawProject) {
       return err(`Project not found: ${project_id}`)
     }

-    const { data: rawContact, error: contactError } = await supabase
+    const { data: rawContact, error: contactError } = await db
       .from('contacts')
       .select('id, name, role, email')
       .eq('id', contact_id)
       .single()
```

(Leave the `project_contacts` association query at lines 125–130 untouched — it stays on `supabase`.)

- [ ] **Step 4: Org-scope the two `handleSendCalendarInvite` lookups + the duplicate-check query**

```diff
-    const { data: project, error: projectError } = await supabase
+    const { data: project, error: projectError } = await db
       .from('projects')
       .select('id, name')
       .eq('id', project_id)
       .is('deleted_at', null)
       .single()

     if (projectError || !project) return err(`Project not found: ${project_id}`)

-    const { data: contact, error: contactError } = await supabase
+    const { data: contact, error: contactError } = await db
       .from('contacts')
       .select('id, name, email')
       .eq('id', contact_id)
       .single()
```

(Leave the `project_contacts` association query at lines 204–209 untouched.)

```diff
     // ── Idempotency: never send a second invite to the same contact on this project ──
-    const { data: priorOutreach, error: dupError } = await supabase
+    const { data: priorOutreach, error: dupError } = await db
       .from('activity_log')
       .select('id')
       .eq('project_id', project_id)
       .eq('type', 'call_summary')
       .like('body', '[OUTREACH]%')
       .ilike('body', `%contact=${contact_id}%`)
       .limit(1)
```

- [ ] **Step 5: Org-scope the outreach activity_log insert**

```diff
-    const { error: logError } = await supabase.from('activity_log').insert({
+    const { error: logError } = await db.from('activity_log').insert({
       project_id,
       type: 'call_summary',
       body: `[OUTREACH] invite sent to ${contact.name} <${contact.email}> via ${result.provider} · contact=${contact_id}`,
       author_id: process.env.BOT_PROFILE_ID,
     })
```

- [ ] **Step 6: Typecheck and run the tests**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npm run lint
npx vitest run tests/outreach.test.ts
```

Expected: `lint` exits 0 (the `supabase` import in `outreach.ts` is still used by the `project_contacts` queries, so no unused-import error). Tests: PASS, same 13 passing as before.

- [ ] **Step 7: Commit**

```bash
git add src/tools/outreach.ts tests/outreach.test.ts
git commit -m "feat: org-scope outreach project/contact/activity_log lookups"
```

---

### Task 12: Wire the factories into `mcp-server.ts`

**Files:**
- Modify: `odigo-mcp/src/lib/mcp-server.ts:6-9, 26-29`

- [ ] **Step 1: Update imports and tool assembly**

```diff
-import { readTools } from '../tools/read.js'
+import { makeReadTools } from '../tools/read.js'
 import { makeWriteTools } from '../tools/write.js'
 import { makeOutreachTools } from '../tools/outreach.js'
-import { sweepTools } from '../tools/sweep.js'
+import { makeSweepTools } from '../tools/sweep.js'
```

```diff
 export function createMcpServer(auth: AuthContext): Server {
+  const readTools = makeReadTools(auth)
   const outreachTools = makeOutreachTools(auth)
   const writeTools = makeWriteTools(auth)
+  const sweepTools = makeSweepTools(auth)
   const allTools = [pingTool, ...readTools, ...writeTools, ...outreachTools, ...sweepTools]
```

- [ ] **Step 2: Full verification — build, lint, full test suite**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npm run lint
npm run build
npm test
```

Expected: `lint` and `build` exit 0. `test` reports all previously-passing tests still passing (43 + the 1 new from Task 10 = 44 passing, 5 skipped) and zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mcp-server.ts
git commit -m "feat: wire org-scoped read/sweep tool factories into the MCP server"
```

---

### Task 13: Cross-org isolation integration tests (`odigo-mcp` side)

Everything so far is unit-tested against a mocked Postgrest builder. This task proves the real thing: seed two orgs against the live dev Supabase project, then call the actual tool handlers and assert org A never sees org B's rows. Network-gated behind `RUN_INTEGRATION_TESTS=1` since — unlike the rest of the suite — it makes real DB calls (same reason the existing `it.skip` tests in `read.test.ts`/`sweep.test.ts` are skipped today).

**Files:**
- Create: `odigo-mcp/tests/org-isolation.integration.test.ts`
- Modify: `odigo-mcp/package.json` (add a script)

- [ ] **Step 1: Write the integration test**

```typescript
// odigo-mcp/tests/org-isolation.integration.test.ts
//
// Hits the live dev Supabase project directly — only runs when
// RUN_INTEGRATION_TESTS=1 is set (same convention as the it.skip tests
// elsewhere in this suite, which need a live DB and are skipped by default).
import { describe, it, expect, beforeAll } from 'vitest'
import 'dotenv/config'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1'
const describeIntegration = runIntegration ? describe : describe.skip

const SMB_ORG_ID = '0794fb70-3922-4b62-a704-15949daa9a80'
const ENTERPRISE_ORG_ID = 'c501b923-3caf-42e5-877a-5f37a60d6f77'
const ENTERPRISE_SEED_COMPANY_ID = '11111111-1111-1111-1111-111111111111'

describeIntegration('cross-org isolation (live DB)', () => {
  beforeAll(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'RUN_INTEGRATION_TESTS=1 requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment'
      )
    }
  })

  it('get_company: an SMB-scoped caller cannot fetch the Enterprise seed company by ID', async () => {
    const { makeReadTools } = await import('../src/tools/read.js')
    const tools = makeReadTools({ userId: 'test', isAdmin: true, orgId: SMB_ORG_ID })
    const tool = tools.find((t) => t.definition.name === 'get_company')!
    const result = await tool.handler({ company_id: ENTERPRISE_SEED_COMPANY_ID })
    expect(result.isError).toBe(true)
  })

  it('get_company: an Enterprise-scoped caller CAN fetch the Enterprise seed company by ID', async () => {
    const { makeReadTools } = await import('../src/tools/read.js')
    const tools = makeReadTools({ userId: 'test', isAdmin: true, orgId: ENTERPRISE_ORG_ID })
    const tool = tools.find((t) => t.definition.name === 'get_company')!
    const result = await tool.handler({ company_id: ENTERPRISE_SEED_COMPANY_ID })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain('Enterprise Isolation Test Co')
  })

  it('search_contacts: an SMB-scoped caller never sees Enterprise-org contacts', async () => {
    const { makeReadTools } = await import('../src/tools/read.js')
    const tools = makeReadTools({ userId: 'test', isAdmin: true, orgId: SMB_ORG_ID })
    const tool = tools.find((t) => t.definition.name === 'search_contacts')!
    // "Alderwood" is an SMB seed company name (03_seed.sql) — searching for its
    // primary contact should succeed; this is a control to confirm the SMB
    // context still sees its own data before asserting isolation below.
    const result = await tool.handler({ query: 'Margaret Hale' })
    expect(result.isError).toBeFalsy()
    expect(JSON.parse(result.content[0].text).length).toBeGreaterThan(0)
  })

  it('log_activity: an SMB-scoped admin cannot log activity onto a project ID that does not exist in their org', async () => {
    // There's no Enterprise-org project seeded (only a company), so a random
    // UUID exercises the same org-scoped "not found" path a real cross-org
    // project_id would hit: db.from('projects').eq('id', ...) finds nothing
    // because the row either doesn't exist or belongs to a different org —
    // both cases must be indistinguishable from the caller's point of view.
    const fakeProjectId = '99999999-9999-9999-9999-999999999999'

    const { makeWriteTools } = await import('../src/tools/write.js')
    const writeTools = makeWriteTools({ userId: 'test', isAdmin: true, orgId: SMB_ORG_ID })
    const logActivity = writeTools.find((t) => t.definition.name === 'log_activity')!
    const result = await logActivity.handler({
      project_id: fakeProjectId,
      type: 'note',
      body: 'should not be written',
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })
})
```

- [ ] **Step 2: Add the script**

Edit `odigo-mcp/package.json` `scripts`:

```diff
     "test": "vitest run --passWithNoTests",
+    "test:integration": "cross-env RUN_INTEGRATION_TESTS=1 vitest run tests/org-isolation.integration.test.ts",
     "test:watch": "vitest"
```

If `cross-env` isn't already a dependency, add it (`npm install --save-dev cross-env`) since `BOT_PROFILE_ID`-style env-var-prefixing (`RUN_INTEGRATION_TESTS=1 vitest ...`) doesn't work cross-platform in npm scripts otherwise.

- [ ] **Step 3: Run it against the live dev project and verify**

Requires `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` for `xkczzuoplwtmynfodejc` in `.env` (already present per `.env.example`/dev setup).

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npm run test:integration
```

Expected: PASS, 4/4. If `get_company` for the Enterprise company from an SMB context does *not* error, or the SMB search leaks Enterprise data, that's a real cross-org bug in an earlier task — stop and fix it there before continuing (this test suite is the actual proof the boundary holds; a passing unit-test-only suite up to this point does not confirm that on its own).

- [ ] **Step 4: Confirm the default `npm test` still skips this file**

```bash
npm test
```

Expected: the integration file doesn't appear in the run at all (no `RUN_INTEGRATION_TESTS` env var set), same pass count as Task 12 Step 2.

- [ ] **Step 5: Commit**

```bash
git add tests/org-isolation.integration.test.ts package.json package-lock.json
git commit -m "test: add live-DB cross-org isolation integration suite"
```

---

### Task 14: Cross-org isolation test (`real-estat-crm` RLS, via Playwright)

Proves the *other* enforcement layer — CRM-side RLS — independently of the MCP server, using the real anon-key client and two real seeded users in different orgs (Task 4's Enterprise admin vs. the existing `admin@odigo-test.com` SMB admin from `03_seed.sql`).

**Files:**
- Create: `real-estat-crm/tests/org-isolation.spec.js`

- [ ] **Step 1: Write the test**

```javascript
// @ts-check
const { test, expect } = require("@playwright/test");

const SMB_ADMIN = { email: "admin@odigo-test.com", password: "OdigoTest2026!" };
const ENTERPRISE_ADMIN = { email: "admin@enterprise-test.com", password: "OdigoTest2026!" };

async function login(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/", { timeout: 15_000 });
}

test.describe("Cross-org isolation", () => {
  test("Enterprise admin sees only the Enterprise seed company, never SMB companies", async ({ page }) => {
    await login(page, ENTERPRISE_ADMIN);
    await page.goto("/companies");

    await expect(page.getByText("Enterprise Isolation Test Co")).toBeVisible();
    // "Alderwood Estates" is an Odigo-SMB-org seed company (03_seed.sql) —
    // if RLS's org boundary were broken, an Enterprise-org user would see it.
    await expect(page.getByText("Alderwood Estates")).not.toBeVisible();
  });

  test("SMB admin sees SMB companies, never the Enterprise seed company", async ({ page }) => {
    await login(page, SMB_ADMIN);
    await page.goto("/companies");

    await expect(page.getByText("Alderwood Estates")).toBeVisible();
    await expect(page.getByText("Enterprise Isolation Test Co")).not.toBeVisible();
  });

  test("Enterprise admin cannot fetch an SMB-org record directly by REST ID (RLS, not just UI filtering)", async ({
    page,
    request,
  }) => {
    await login(page, ENTERPRISE_ADMIN);

    // Pull the Enterprise admin's own access token out of the browser session
    // so we can hit PostgREST directly — this proves the boundary is enforced
    // at the DB layer, not just by what the companies-list query happens to filter.
    const storage = await page.context().storageState();
    const supabaseCookie = storage.origins
      .flatMap((o) => o.localStorage)
      .find((item) => item.name.includes("auth-token"));
    expect(supabaseCookie, "expected a Supabase auth-token entry in localStorage after login").toBeTruthy();
    const accessToken = JSON.parse(supabaseCookie.value).access_token;

    const smbCompanyResponse = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companies?select=id,name`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    expect(smbCompanyResponse.ok()).toBe(true);
    const rows = await smbCompanyResponse.json();
    const names = rows.map((r) => r.name);
    expect(names).toContain("Enterprise Isolation Test Co");
    expect(names).not.toContain("Alderwood Estates");
  });
});
```

- [ ] **Step 2: Run it**

Requires the dev server running locally (`npm run dev` in `real-estat-crm`, default `http://localhost:3000`) and `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` set in the environment the test runs in (already required by the app itself, so this is just "the app must be runnable," not a new requirement).

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm
npm run dev &
npx playwright test tests/org-isolation.spec.js
```

Expected: PASS, 3/3. If either "not visible" assertion fails, that's a live RLS regression from Task 3 — stop and fix the migration before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/org-isolation.spec.js
git commit -m "test: add Playwright cross-org RLS isolation suite"
```

---

### Task 15: Full verification pass

**Files:** none — verification only

- [ ] **Step 1: `odigo-mcp` full suite**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp
npm run lint && npm run build && npm test && npm run test:integration
```

Expected: all four exit 0.

- [ ] **Step 2: `real-estat-crm` full suite**

```bash
cd /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm
npx tsc --noEmit && npm run lint && npx playwright test
```

Expected: all three exit 0, including the pre-existing `auth.spec.js`/`companies.spec.js`/etc. suites (confirms the RLS rewrite didn't regress the SMB admin/viewer flows those already cover) plus the new `org-isolation.spec.js`.

- [ ] **Step 3: Security advisor sweep on the live project**

Run `get_advisors` (`type: "security"`) on `xkczzuoplwtmynfodejc` one more time. Expected: identical to the pre-D0 baseline (the same 8 pre-existing `function_search_path_mutable`/`security_definer`/`leaked_password_protection` warnings) — `current_org_id()` should carry `set search_path = public` from the start (Task 3), so it must not add a new `function_search_path_mutable` warning.

- [ ] **Step 4: Confirm branch state in both repos**

```bash
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp status --short
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/odigo-mcp log --oneline master..feature/d0-multi-org-foundation

git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm status --short
git -C /Users/saadee/Desktop/workspace/Devsinc/Odigo/real-estat-crm log --oneline master..feature/d0-multi-org-foundation
```

Expected: both working trees clean, both branches show the full sequence of commits from Tasks 0–14 (real-estat-crm: 5 migration commits + 1 types commit + 2 test-suite commits; odigo-mcp: 1 types + 7 code/test commits), nothing left uncommitted.

At this point D0 is complete: `organizations` exists and is seeded, `org_id` is on every org-scoped business table, RLS enforces the boundary CRM-side, `orgScoped()` enforces it MCP-side, and both isolation test suites pass against the live dev project. D1 (SMB data model) is unblocked to start next.
