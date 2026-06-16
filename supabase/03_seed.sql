-- ============================================================
-- Odigo CRM — Seed data (03)
--
-- Creates two test accounts and a realistic set of CRM records for a
-- Pacific NW premium general contractor.
--
-- Test accounts (password for both: OdigoTest2026!)
--   admin@odigo-test.com   → Admin  (full read/write)
--   viewer@odigo-test.com  → Viewer (read-only)
--
-- Safe to re-run: it removes the two seed users (and cascading data)
-- before recreating everything.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Clean prior seed (idempotent) ----------
delete from auth.users
  where email in ('admin@odigo-test.com', 'viewer@odigo-test.com');
-- profiles / projects.assigned_to cascade or null out via FKs above.
truncate table public.activity_log, public.project_contacts,
               public.projects, public.contacts, public.companies
         restart identity cascade;

-- ---------- Auth users ----------
-- GoTrue v2.189.0+ requires token columns to be '' not NULL.
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
   'authenticated', 'authenticated', 'admin@odigo-test.com',
   extensions.crypt('OdigoTest2026!', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Eddie (Admin)","role":"admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
   'authenticated', 'authenticated', 'viewer@odigo-test.com',
   extensions.crypt('OdigoTest2026!', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Sam (Viewer)","role":"viewer"}', now(), now());

-- Elevate the admin account. The handle_new_user trigger always assigns 'viewer';
-- role promotion must be done explicitly (never via user-supplied metadata).
update public.profiles set role = 'admin' where email = 'admin@odigo-test.com';

-- ---------- Email identities (required for password login) ----------
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('admin@odigo-test.com', 'viewer@odigo-test.com');

-- ---------- CRM data ----------
do $$
declare
  admin_id uuid;
  c_alderwood uuid; c_meridian uuid; c_summit uuid; c_harbor uuid; c_cascade uuid;
  ct1 uuid; ct2 uuid; ct3 uuid; ct4 uuid; ct5 uuid; ct6 uuid; ct7 uuid; ct8 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid; p8 uuid;
begin
  select id into admin_id from public.profiles where email = 'admin@odigo-test.com';

  insert into public.companies (name, segment, address, primary_contact, phone, email, notes) values
    ('Alderwood Estates','residential','1420 Lakeview Dr, Bellevue, WA 98004','Margaret Hale','(425) 555-0118','mhale@alderwood.com','Repeat client. High-end lakefront builds. Values discretion.') returning id into c_alderwood;
  insert into public.companies (name, segment, address, primary_contact, phone, email, notes) values
    ('Meridian Commercial Group','commercial','88 Pike St, Suite 900, Seattle, WA 98101','David Okonkwo','(206) 555-0143','dokonkwo@meridiancg.com','Light commercial fit-outs. Fast decision-makers.') returning id into c_meridian;
  insert into public.companies (name, segment, address, primary_contact, phone, email, notes) values
    ('Summit Ridge Developments','residential','305 Alpine Way, Issaquah, WA 98027','Priya Raman','(425) 555-0176','praman@summitridge.com','Spec homes in the foothills. Design-forward.') returning id into c_summit;
  insert into public.companies (name, segment, address, primary_contact, phone, email, notes) values
    ('Harbor & Co. Hospitality','commercial','12 Marina Blvd, Tacoma, WA 98402','Liam Brennan','(253) 555-0190','liam@harborco.com','Boutique restaurant + hotel TI work.') returning id into c_harbor;
  insert into public.companies (name, segment, address, primary_contact, phone, email, notes) values
    ('Cascade Industrial Partners','industrial','700 Foundry Rd, Kent, WA 98032','Nina Castellano','(253) 555-0211','nina@cascadeip.com','Warehouse + light manufacturing shells.') returning id into c_cascade;

  insert into public.contacts (company_id, name, role, phone, email) values
    (c_alderwood,'Margaret Hale','Owner','(425) 555-0118','mhale@alderwood.com') returning id into ct1;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_alderwood,'Tom Hale','Project Liaison','(425) 555-0119','thale@alderwood.com') returning id into ct2;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_meridian,'David Okonkwo','Facilities Director','(206) 555-0143','dokonkwo@meridiancg.com') returning id into ct3;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_meridian,'Sarah Kim','Operations Manager','(206) 555-0144','skim@meridiancg.com') returning id into ct4;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_summit,'Priya Raman','Principal','(425) 555-0176','praman@summitridge.com') returning id into ct5;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_harbor,'Liam Brennan','Managing Partner','(253) 555-0190','liam@harborco.com') returning id into ct6;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_harbor,'Ava Sørensen','Design Lead','(253) 555-0191','ava@harborco.com') returning id into ct7;
  insert into public.contacts (company_id, name, role, phone, email) values
    (c_cascade,'Nina Castellano','VP Development','(253) 555-0211','nina@cascadeip.com') returning id into ct8;

  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Hale Lakefront Residence', c_alderwood,'active',   current_date-40, current_date+25,  2850000, admin_id,'Framing complete. Window package delayed two weeks.') returning id into p1;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Meridian 9th Floor Fit-Out', c_meridian,'active',  current_date-15, current_date+18,   640000, admin_id,'Demo done. MEP rough-in underway.') returning id into p2;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Summit Ridge Lot 7 Spec Home', c_summit,'proposal',current_date+20, current_date+230, 1450000, admin_id,'Awaiting signed proposal. Client reviewing finishes budget.') returning id into p3;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Harbor Boutique Hotel TI', c_harbor,'proposal',    current_date+35, current_date+200, 1980000, admin_id,'Proposal sent. Negotiating scope on lobby millwork.') returning id into p4;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Cascade Kent Warehouse Shell', c_cascade,'lead',   current_date+60, current_date+320, 3200000, admin_id,'Initial site walk done. Awaiting RFP.') returning id into p5;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Brennan Waterfront Bistro', c_harbor,'lead',       current_date+45, current_date+160,  720000, admin_id,'Referral from hotel project. Early conversations.') returning id into p6;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Alderwood Guest House', c_alderwood,'completed',   current_date-210,current_date-20,   540000, admin_id,'Delivered on schedule. Final walkthrough signed off.') returning id into p7;
  insert into public.projects (name, company_id, stage, start_date, estimated_end_date, project_value, assigned_to, status_note) values
    ('Meridian Lobby Refresh', c_meridian,'completed',   current_date-150,current_date-35,   310000, admin_id,'Closed out. Punch list complete.') returning id into p8;

  insert into public.project_contacts (project_id, contact_id) values
    (p1,ct1),(p1,ct2),(p2,ct3),(p2,ct4),(p3,ct5),
    (p4,ct6),(p4,ct7),(p5,ct8),(p6,ct6),(p7,ct1),(p8,ct3);

  insert into public.activity_log (project_id, author_id, type, body, created_at) values
    (p1,admin_id,'note','Kickoff meeting held on site with the Hales. Confirmed cedar siding selection.', now()-interval '38 days'),
    (p1,admin_id,'status_change','Moved from Proposal to Active after contract signing.', now()-interval '40 days'),
    (p1,admin_id,'call_summary','Call with window supplier: lead time pushed to 6 weeks. Adjusting framing sequence.', now()-interval '3 days'),
    (p1,admin_id,'file_reference','Uploaded revised structural drawings (Rev C) to project drive.', now()-interval '2 days'),
    (p2,admin_id,'note','Tenant improvement permit approved by City of Seattle.', now()-interval '14 days'),
    (p2,admin_id,'call_summary','Coordination call with electrical sub. Rough-in starts Monday.', now()-interval '1 day'),
    (p3,admin_id,'note','Sent finish-level options A/B/C to Priya.', now()-interval '5 days'),
    (p4,admin_id,'status_change','Moved to Proposal. Estimate delivered.', now()-interval '6 days'),
    (p4,admin_id,'call_summary','Liam wants to value-engineer the lobby millwork. Pricing alternates.', now()-interval '12 hours'),
    (p5,admin_id,'note','Site walk complete. Soil report ordered.', now()-interval '4 days'),
    (p7,admin_id,'status_change','Project completed and signed off.', now()-interval '20 days'),
    (p8,admin_id,'note','Punch list closed. Retention released.', now()-interval '35 days');
end $$;
