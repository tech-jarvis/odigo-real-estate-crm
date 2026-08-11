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
