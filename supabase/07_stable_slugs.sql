-- =====================================================================
-- Migration: stable_slugs_insert_only
--
-- Problem: slug was GENERATED ALWAYS AS STORED, which means PostgreSQL
-- recomputes it on every UPDATE. Changing a project name silently broke
-- every existing link/bookmark to that project (404 on old slug).
--
-- Fix: snapshot current slugs into a regular column, then attach an
-- INSERT-only trigger so the slug is set once at creation and never
-- touched again on update.
-- =====================================================================

-- 1. Snapshot current computed slug values
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS slug_snap text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug_snap text;

UPDATE public.projects  SET slug_snap = slug;
UPDATE public.companies SET slug_snap = slug;

-- 2. Drop the GENERATED ALWAYS columns
ALTER TABLE public.projects  DROP COLUMN slug;
ALTER TABLE public.companies DROP COLUMN slug;

-- 3. Promote snapshot to canonical slug
ALTER TABLE public.projects  RENAME COLUMN slug_snap TO slug;
ALTER TABLE public.companies RENAME COLUMN slug_snap TO slug;

ALTER TABLE public.projects  ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.companies ALTER COLUMN slug SET NOT NULL;

-- 4. Unique indexes (replaces the implicit constraint from the generated column)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug  ON public.projects(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);

-- 5. Reusable slugify helper
CREATE OR REPLACE FUNCTION public.slugify(input_text text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(trim(input_text), '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  )
$$;

-- 6. Trigger function: runs BEFORE INSERT only
--    Slug is never touched on UPDATE — existing URLs stay stable forever.
CREATE OR REPLACE FUNCTION public.trg_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug := public.slugify(NEW.name);
  RETURN NEW;
END;
$$;

-- 7. Attach to projects (INSERT only)
DROP TRIGGER IF EXISTS set_project_slug  ON public.projects;
CREATE TRIGGER set_project_slug
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_slug();

-- 8. Attach to companies (INSERT only)
DROP TRIGGER IF EXISTS set_company_slug ON public.companies;
CREATE TRIGGER set_company_slug
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_slug();

-- 9. Clean up XSS test records created during manual testing
DELETE FROM public.projects WHERE name LIKE '%<%>%';
