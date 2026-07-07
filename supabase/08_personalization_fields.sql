-- ============================================================
-- Odigo CRM — Personalization Fields (08)
-- Adds industry and funnel_source to companies for MCP outreach.
-- ============================================================

alter table public.companies
  add column if not exists industry     text,
  add column if not exists funnel_source text;

comment on column public.companies.industry      is 'e.g. residential-developer, commercial-builder';
comment on column public.companies.funnel_source is 'e.g. referral, cold-outreach, website';
