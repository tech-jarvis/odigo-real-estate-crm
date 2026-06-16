-- ============================================================
-- Add slug columns to companies and projects for URL-safe IDs
-- ============================================================

-- Add slug column to companies
alter table public.companies
add column slug text unique not null generated always as (
  lower(regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ))
) stored;

-- Add slug column to projects
alter table public.projects
add column slug text unique not null generated always as (
  lower(regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ))
) stored;

-- Add indexes for slug lookups (faster than UUID for user-facing URLs)
create index idx_companies_slug on public.companies(slug);
create index idx_projects_slug on public.projects(slug);

-- Update seed data comment
-- Note: Slugs are automatically generated from company/project names
-- Examples: "Acme Corp" → "acme-corp", "Project ABC-123" → "project-abc-123"
