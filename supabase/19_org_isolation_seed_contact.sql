-- ============================================================
-- Odigo CRM — org isolation test fixtures: contact (19)
--
-- Task 13's search_contacts isolation test needs a real Enterprise-org
-- contact to prove cross-org search actually excludes it — without one,
-- the assertion "SMB search never sees Enterprise contacts" is vacuously
-- true regardless of whether org-scoping actually works, since there was
-- nothing there to leak. Safe to re-run.
-- ============================================================

insert into public.contacts (id, company_id, name, org_id)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Enterprise Test Contact',
  'c501b923-3caf-42e5-877a-5f37a60d6f77'
)
on conflict (id) do nothing;
