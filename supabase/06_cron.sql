-- ============================================================
-- Odigo CRM — Scheduled Cleanup (06)
--
-- Permanently purges soft-deleted projects that have been in the
-- trash for more than 15 days. Runs daily at 02:00 UTC via pg_cron.
--
-- How to apply:
--   1. Supabase Dashboard → Database → Extensions → enable "pg_cron"
--   2. Paste this file into the SQL Editor and run it.
--
-- To verify the job is scheduled:
--   SELECT * FROM cron.job;
--
-- To remove the schedule:
--   SELECT cron.unschedule('cleanup-deleted-projects');
-- ============================================================

-- Enable pg_cron (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing schedule with this name before (re-)registering
SELECT cron.unschedule('cleanup-deleted-projects')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-deleted-projects'
);

-- Schedule daily at 02:00 UTC
SELECT cron.schedule(
  'cleanup-deleted-projects',          -- job name
  '0 2 * * *',                         -- cron expression: daily at 02:00 UTC
  $$
    DELETE FROM public.projects
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '15 days';
  $$
);
