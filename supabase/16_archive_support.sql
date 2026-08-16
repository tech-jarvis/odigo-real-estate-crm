-- Migration 16: Archive support for companies and contacts
-- Adds reversible archive flag to companies and contacts,
-- and matching archive_* permission keys for role-based access control.

-- ── Archive flag on companies ──────────────────────────────────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_companies_archived ON public.companies(archived) WHERE archived = true;

-- ── Archive flag on contacts ───────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contacts_archived ON public.contacts(archived) WHERE archived = true;

-- ── Archive permission keys ────────────────────────────────────────────────
-- ADD VALUE cannot run inside a transaction block in PostgreSQL,
-- so each must be its own statement. IF NOT EXISTS is a safety guard.
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'archive_projects';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'archive_companies';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'archive_contacts';
