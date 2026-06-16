-- ============================================================
-- Odigo CRM — File Attachments (05)
-- Adds file_url to activity_log + project-files storage bucket
-- ============================================================

-- Add nullable file_url column to activity_log
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS file_url text;

-- Storage bucket for project file attachments (50 MB limit per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload (consistent with activity_log insert policy)
CREATE POLICY "admins can upload project files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.is_admin());

-- All authenticated users can read (consistent with CRM read-all model)
CREATE POLICY "auth can read project files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');
