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
