-- LOCAL ONLY: demo laboratory with the ERP module for manual testing.
-- Never run against production. Idempotent (fixed ids, ON CONFLICT DO NOTHING).
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed_erp_demo.sql
--
-- Test users (local passwords, generated for this seed):
--   admin.erp@demo.local       / xEfXNZ3uTgM9   (lab_admin)
--   secretaria.erp@demo.local  / HzTAzQPfR9Ez   (secretary)
--   bio.erp@demo.local         / C90r142arzBH   (bioanalyst)

begin;

insert into public.organizations (id, name, address, phone, email, city, has_erp_module, is_active, subscription_active)
values ('e7900000-0000-4000-8000-000000000001', 'Laboratorio Demo ERP', 'Av. Principal, Caracas', '0212-0000000', 'demo@demo.local', 'Caracas', true, true, true)
on conflict (id) do update set has_erp_module = true;

with users(id, email, password, full_name, role) as (
  values
    ('e7900000-0000-4000-8000-0000000000a1'::uuid, 'admin.erp@demo.local', 'xEfXNZ3uTgM9', 'Admin Demo', 'lab_admin'::public.user_role),
    ('e7900000-0000-4000-8000-0000000000a2'::uuid, 'secretaria.erp@demo.local', 'HzTAzQPfR9Ez', 'Secretaria Demo', 'secretary'::public.user_role),
    ('e7900000-0000-4000-8000-0000000000a3'::uuid, 'bio.erp@demo.local', 'C90r142arzBH', 'Bioanalista Demo', 'bioanalyst'::public.user_role)
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
         extensions.crypt(password, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(), '', '', '', ''
  from users
  on conflict (id) do nothing
  returning id
)
select count(*) from new_users;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.id in ('e7900000-0000-4000-8000-0000000000a1', 'e7900000-0000-4000-8000-0000000000a2', 'e7900000-0000-4000-8000-0000000000a3')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.profiles (id, org_id, role, full_name, email, firma_url, signature_footer_text) values
  ('e7900000-0000-4000-8000-0000000000a1', 'e7900000-0000-4000-8000-000000000001', 'lab_admin', 'Admin Demo', 'admin.erp@demo.local', '/favicon.png', 'Lic. Admin Demo'),
  ('e7900000-0000-4000-8000-0000000000a2', 'e7900000-0000-4000-8000-000000000001', 'secretary', 'Secretaria Demo', 'secretaria.erp@demo.local', null, null),
  ('e7900000-0000-4000-8000-0000000000a3', 'e7900000-0000-4000-8000-000000000001', 'bioanalyst', 'Bioanalista Demo', 'bio.erp@demo.local', '/favicon.png', 'Lic. Bioanalista Demo')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select v.user_id, v.role from (values
  ('e7900000-0000-4000-8000-0000000000a1'::uuid, 'lab_admin'::public.user_role),
  ('e7900000-0000-4000-8000-0000000000a2'::uuid, 'secretary'::public.user_role),
  ('e7900000-0000-4000-8000-0000000000a3'::uuid, 'bioanalyst'::public.user_role)
) v(user_id, role)
where not exists (select 1 from public.user_roles r where r.user_id = v.user_id);

insert into public.exchange_rates (org_id, rate, updated_by)
select 'e7900000-0000-4000-8000-000000000001', 40, 'e7900000-0000-4000-8000-0000000000a1'
where not exists (select 1 from public.exchange_rates where org_id = 'e7900000-0000-4000-8000-000000000001');

insert into public.exchange_rate_history (org_id, from_currency, to_currency, rate, effective_date, created_by, source)
values ('e7900000-0000-4000-8000-000000000001', 'USD', 'VES', 40, current_date, 'e7900000-0000-4000-8000-0000000000a1', 'seed')
on conflict (org_id, from_currency, to_currency, effective_date) do nothing;

insert into public.bank_accounts (org_id, name, method_type, currency, sort_order) values
  ('e7900000-0000-4000-8000-000000000001', 'Efectivo USD', 'cash', 'USD', 1),
  ('e7900000-0000-4000-8000-000000000001', 'Efectivo Bs', 'cash', 'VES', 2),
  ('e7900000-0000-4000-8000-000000000001', 'Zelle', 'zelle', 'USD', 3),
  ('e7900000-0000-4000-8000-000000000001', 'Pago móvil', 'mobile_payment', 'VES', 4)
on conflict (org_id, name) do nothing;

insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  ('e7900000-0000-4000-8000-0000000000b1', 'e7900000-0000-4000-8000-000000000001', 'V-10000001', 'María', 'Pérez', '1985-04-12', 'femenino', 'e7900000-0000-4000-8000-0000000000a1'),
  ('e7900000-0000-4000-8000-0000000000b2', 'e7900000-0000-4000-8000-000000000001', 'V-10000002', 'José', 'Rodríguez', '1979-11-03', 'masculino', 'e7900000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

insert into public.test_templates (id, org_id, name, category, base_price, schema, is_active, result_type) values
  ('e7900000-0000-4000-8000-0000000000c1', 'e7900000-0000-4000-8000-000000000001', 'Glicemia', 'Bioquimica', 8,
   '{"sections":[{"id":"e7900000-0000-4000-8000-0000000000d1","name":"","fields":[{"id":"e7900000-0000-4000-8000-0000000000e1","type":"number","unit":"mg/dL","label":"Glicemia","range":null,"reference_ranges":[]}]}]}', true, 'STANDARD'),
  ('e7900000-0000-4000-8000-0000000000c2', 'e7900000-0000-4000-8000-000000000001', 'Hematología Completa', 'Hematologia', 15,
   '{"sections":[{"id":"e7900000-0000-4000-8000-0000000000d2","name":"","fields":[{"id":"e7900000-0000-4000-8000-0000000000e2","type":"number","unit":"g/dL","label":"Hemoglobina","range":null,"reference_ranges":[]}]}]}', true, 'STANDARD')
on conflict (id) do nothing;

commit;
