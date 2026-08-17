-- Migration 17: Ensure invitations.cancelled_at column exists
-- The column is referenced in application code and database.types.ts
-- but was not included in the original migration 14.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
