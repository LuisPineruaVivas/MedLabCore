-- Regression test for security audit run-1 (migration 20261019000000_audit_authz_fixes).
-- Every reproduction from the audit's findings.json is replayed here and must now fail,
-- next to the legitimate path that must keep working. Runs inside a transaction and
-- rolls back, so it leaves no data behind:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/audit_authz_fixes.sql
-- (prepend the migration if it is not applied yet). Prints "Audit authz fixes passed".

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  -- Run the statement in its own block so its success cannot be caught below
  -- and mistaken for the expected error.
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    if sqlerrm not like '%' || p_pattern || '%' then
      raise exception 'Expected error matching "%" but got "%" for: %', p_pattern, sqlerrm, p_sql;
    end if;
  end;
  if not v_failed then
    raise exception 'Expected error matching "%" but statement succeeded: %', p_pattern, p_sql;
  end if;
end;
$$;

create function pg_temp.assert_eq(p_actual numeric, p_expected numeric, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Assertion failed (%): expected %, got %', p_label, p_expected, p_actual;
  end if;
end;
$$;

create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'Assertion failed: %', p_label; end if;
end;
$$;

-- Fixture writes keep role postgres and only set the JWT claims (like erp_rpcs_smoke).
create function pg_temp.claims(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Attacks run as the PostgREST role, exactly like a browser request.
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end;
$$;

-- ---------------------------------------------------------------------------
-- Static checks: no anon EXECUTE on the fixed RPCs; the trigger helper is not an API.
-- ---------------------------------------------------------------------------
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.bulk_upsert_org_prices(uuid,jsonb)',
    'public.upsert_exam_profile(uuid,uuid,text,text,numeric,uuid[])',
    'public.get_dashboard_summary(uuid)',
    'public.get_dashboard_top_tests(uuid,integer)',
    'public.fn_log_audit_event(uuid,text,text,uuid,jsonb)',
    'public.create_lab_order(uuid,uuid,text,numeric,numeric,boolean,jsonb,uuid)'
  ] loop
    if has_function_privilege('anon', v_fn, 'execute') then raise exception 'anon can execute %', v_fn; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.fn_log_audit_event(uuid,text,text,uuid,jsonb)', 'execute') then
    raise exception 'authenticated can execute fn_log_audit_event';
  end if;
  if not has_function_privilege('anon', 'public.get_public_org_brand(uuid)', 'execute') then
    raise exception 'anon cannot execute get_public_org_brand';
  end if;
  if has_table_privilege('anon', 'public.organizations', 'select') then raise exception 'anon can select organizations'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures: ERP lab A, non-ERP lab B, a super admin.
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('secA', gen_random_uuid()), ('bioA', gen_random_uuid()), ('affA', gen_random_uuid()),
  ('adminB', gen_random_uuid()), ('secB', gen_random_uuid()), ('bioB', gen_random_uuid()),
  ('superAdmin', gen_random_uuid()),
  ('patientA', gen_random_uuid()), ('patientB', gen_random_uuid()),
  ('templateA', gen_random_uuid()), ('templateB', gen_random_uuid()), ('templateG', gen_random_uuid()),
  ('profileB', gen_random_uuid()), ('accZelle', gen_random_uuid());
grant select on ids to authenticated, anon;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, has_erp_module, subscription_active, is_active, rif, email) values
  (pg_temp.id('orgA'), 'Audit Test A', true, true, true, 'J-AUDIT-A', 'a@audit-test.local'),
  (pg_temp.id('orgB'), 'Audit Test B', false, false, false, 'J-AUDIT-B', 'b@audit-test.local');

insert into auth.users (id, email)
select v, k || '@audit-test.local' from ids
where k in ('adminA', 'secA', 'bioA', 'affA', 'adminB', 'secB', 'bioB', 'superAdmin');

insert into public.profiles (id, org_id, role, full_name, email, firma_url, sello_url) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@audit-test.local', null, null),
  (pg_temp.id('secA'), pg_temp.id('orgA'), 'secretary', 'Secretaria A', 'secA@audit-test.local', null, null),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@audit-test.local', 'https://example.invalid/bioA.png', null),
  (pg_temp.id('affA'), pg_temp.id('orgA'), 'lab_affiliate', 'Afiliado A', 'affA@audit-test.local', null, null),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@audit-test.local', null, null),
  (pg_temp.id('secB'), pg_temp.id('orgB'), 'secretary', 'Secretaria B', 'secB@audit-test.local', null, null),
  (pg_temp.id('bioB'), pg_temp.id('orgB'), 'bioanalyst', 'Bio B', 'bioB@audit-test.local', 'https://example.invalid/bioB.png', 'https://example.invalid/selloB.png'),
  (pg_temp.id('superAdmin'), pg_temp.id('orgA'), 'super_admin', 'Super Admin', 'sa@audit-test.local', null, null)
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
  firma_url = excluded.firma_url, sello_url = excluded.sello_url;

insert into public.user_roles (user_id, role) values
  (pg_temp.id('adminA'), 'lab_admin'), (pg_temp.id('secA'), 'secretary'), (pg_temp.id('bioA'), 'bioanalyst'),
  (pg_temp.id('affA'), 'lab_affiliate'), (pg_temp.id('adminB'), 'lab_admin'), (pg_temp.id('secB'), 'secretary'),
  (pg_temp.id('bioB'), 'bioanalyst'), (pg_temp.id('superAdmin'), 'super_admin');

insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  (pg_temp.id('patientA'), pg_temp.id('orgA'), 'AUDIT-A-1', 'Paciente', 'A', '1990-01-01', 'femenino', pg_temp.id('adminA')),
  (pg_temp.id('patientB'), pg_temp.id('orgB'), 'AUDIT-B-2', 'Ficticio', 'Victima', '1990-01-01', 'masculino', pg_temp.id('adminB'));

insert into public.test_templates (id, org_id, name, category, base_price) values
  (pg_temp.id('templateA'), pg_temp.id('orgA'), 'Audit A Test', 'Audit', 10),
  (pg_temp.id('templateB'), pg_temp.id('orgB'), 'Audit B Test', 'Audit', 20),
  (pg_temp.id('templateG'), null, 'Audit Global Test', 'Audit', 10);

insert into public.exam_profiles (id, org_id, name, total_price) values (pg_temp.id('profileB'), pg_temp.id('orgB'), 'Audit B Profile', 50);
insert into public.profile_templates_junction (profile_id, template_id) values (pg_temp.id('profileB'), pg_temp.id('templateB'));

insert into public.bank_accounts (id, org_id, name, method_type, currency)
values (pg_temp.id('accZelle'), pg_temp.id('orgA'), 'Zelle', 'zelle', 'USD');

-- Orders: A (ERP, invoiced) and three in B (non-ERP).
select pg_temp.claims(pg_temp.id('secA'));
insert into ids select 'orderA', (public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, null, false,
  '[{"test_name":"Audit A","price":10}]'::jsonb, pg_temp.id('secA'))->>'orderId')::uuid;
insert into ids select 'invoiceA', id from public.invoices where order_id = pg_temp.id('orderA');
select pg_temp.claims(pg_temp.id('secB'));
insert into ids select 'orderB1', (public.create_lab_order(pg_temp.id('orgB'), pg_temp.id('patientB'), null, 40, null, false,
  '[{"test_name":"Audit B Dummy Test","price":77.70}]'::jsonb, pg_temp.id('secB'))->>'orderId')::uuid;
insert into ids select 'orderB2', (public.create_lab_order(pg_temp.id('orgB'), pg_temp.id('patientB'), null, 40, null, false,
  '[{"test_name":"Audit B Dummy Test","price":10}]'::jsonb, pg_temp.id('secB'))->>'orderId')::uuid;
insert into ids select 'itemB1', id from public.order_items where order_id = pg_temp.id('orderB1');
update public.orders set status = 'por_aprobar' where id in (pg_temp.id('orderB1'), pg_temp.id('orderB2'));
-- An affiliate order in B is not possible (B has no affiliate); use an A affiliate order for settlement.
select pg_temp.claims(pg_temp.id('affA'));
insert into ids select 'orderAff', (public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, null, false,
  '[{"test_name":"Perfil caro","price":100}]'::jsonb, pg_temp.id('affA'))->>'orderId')::uuid;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- 1. rpc/bulk_upsert_org_prices/missing-super-admin-check
-- ===========================================================================
savepoint s;
select pg_temp.act_as_anon();
select pg_temp.expect_error(format('select public.bulk_upsert_org_prices(%L, %L::jsonb)', pg_temp.id('orgB'),
  json_build_array(json_build_object('global_template_id', pg_temp.id('templateB'), 'price', 0.01))), 'permission denied');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.bulk_upsert_org_prices(%L, %L::jsonb)', pg_temp.id('orgB'),
  json_build_array(json_build_object('global_template_id', pg_temp.id('templateB'), 'price', 0.03))), 'PERMISSION_DENIED');
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.expect_error(format('select public.bulk_upsert_org_prices(%L, %L::jsonb)', pg_temp.id('orgB'),
  json_build_array(json_build_object('global_template_id', pg_temp.id('templateB'), 'price', 0.03))), 'PERMISSION_DENIED');
reset role;
select pg_temp.assert_eq((select base_price from public.test_templates where id = pg_temp.id('templateB')), 20, 'org B price untouched');
select pg_temp.assert_eq((select count(*) from public.test_templates where org_id = pg_temp.id('orgB')), 1, 'no clone in org B');
-- Super admin keeps the feature.
select pg_temp.act_as(pg_temp.id('superAdmin'));
select pg_temp.assert_eq((public.bulk_upsert_org_prices(pg_temp.id('orgB'),
  json_build_array(json_build_object('global_template_id', pg_temp.id('templateB'), 'price', 25))::jsonb)->>'applied')::numeric, 1, 'super admin reprices');
reset role;
select pg_temp.assert_eq((select base_price from public.test_templates where id = pg_temp.id('templateB')), 25, 'super admin price applied');
rollback to savepoint s;

-- ===========================================================================
-- 2. rpc/upsert_exam_profile/no-caller-org-role-check
-- ===========================================================================
savepoint s;
select pg_temp.act_as_anon();
select pg_temp.expect_error(format('select public.upsert_exam_profile(null, %L, %L, %L, 0.01, array[%L]::uuid[])',
  pg_temp.id('orgB'), 'ANON INSERTED', 'x', pg_temp.id('templateB')), 'permission denied');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.upsert_exam_profile(null, %L, %L, %L, 0.01, null)',
  pg_temp.id('orgB'), 'CROSS INSERTED', 'x'), 'PERMISSION_DENIED');
-- Overwrite of B's profile through A's org id now misses (UPDATE is org-scoped).
select pg_temp.expect_error(format('select public.upsert_exam_profile(%L, %L, %L, %L, 0, null)',
  pg_temp.id('profileB'), pg_temp.id('orgA'), 'OVERWROTE', 'x'), 'PROFILE_NOT_FOUND');
-- Linking another org's template is rejected.
select pg_temp.expect_error(format('select public.upsert_exam_profile(null, %L, %L, %L, 1, array[%L]::uuid[])',
  pg_temp.id('orgA'), 'A profile', 'x', pg_temp.id('templateB')), 'INVALID_TEMPLATE');
select pg_temp.act_as(pg_temp.id('secB'));
select pg_temp.expect_error(format('select public.upsert_exam_profile(%L, %L, %L, %L, 0, null)',
  pg_temp.id('profileB'), pg_temp.id('orgB'), 'SECRETARY', 'x'), 'PERMISSION_DENIED');
reset role;
select pg_temp.assert_true((select name = 'Audit B Profile' and total_price = 50 from public.exam_profiles where id = pg_temp.id('profileB')), 'org B profile untouched');
select pg_temp.assert_eq((select count(*) from public.profile_templates_junction where profile_id = pg_temp.id('profileB')), 1, 'org B links untouched');
select pg_temp.assert_eq((select count(*) from public.exam_profiles where org_id = pg_temp.id('orgB')), 1, 'no profile injected into org B');
-- The lab's own admin still manages profiles, with global and own templates.
select pg_temp.act_as(pg_temp.id('adminB'));
select public.upsert_exam_profile(pg_temp.id('profileB'), pg_temp.id('orgB'), 'Audit B Profile v2', null, 60,
  array[pg_temp.id('templateB'), pg_temp.id('templateG')]);
reset role;
select pg_temp.assert_eq((select count(*) from public.profile_templates_junction where profile_id = pg_temp.id('profileB')), 2, 'admin B updated links');
rollback to savepoint s;

-- ===========================================================================
-- 3. rpc/get_dashboard_summary+get_dashboard_top_tests/no-caller-org-binding
-- ===========================================================================
savepoint s;
select pg_temp.act_as_anon();
select pg_temp.expect_error(format('select public.get_dashboard_summary(%L)', pg_temp.id('orgB')), 'permission denied');
select pg_temp.expect_error(format('select * from public.get_dashboard_top_tests(%L, 5)', pg_temp.id('orgB')), 'permission denied');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.get_dashboard_summary(%L)', pg_temp.id('orgB')), 'PERMISSION_DENIED');
select pg_temp.expect_error(format('select * from public.get_dashboard_top_tests(%L, 5)', pg_temp.id('orgB')), 'PERMISSION_DENIED');
select pg_temp.act_as(pg_temp.id('secB'));
select pg_temp.assert_eq((public.get_dashboard_summary(pg_temp.id('orgB'))->>'totalPatients')::numeric, 1, 'own dashboard works');
select pg_temp.assert_true((select name = 'Audit B Dummy Test' and count = 2 from public.get_dashboard_top_tests(pg_temp.id('orgB'), 5) limit 1), 'own top tests work');
select pg_temp.act_as(pg_temp.id('superAdmin'));
select pg_temp.assert_eq((public.get_dashboard_summary(pg_temp.id('orgB'))->>'totalPatients')::numeric, 1, 'super admin dashboard works');
reset role;
rollback to savepoint s;

-- ===========================================================================
-- 4. rpc/fn_log_audit_event/forgeable-cross-tenant-audit
-- ===========================================================================
savepoint s;
select pg_temp.act_as_anon();
select pg_temp.expect_error(format('select public.fn_log_audit_event(%L, %L, %L, null, %L::jsonb)',
  pg_temp.id('orgB'), 'DELETE', 'patient', '{"forged":true}'), 'permission denied');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.fn_log_audit_event(%L, %L, %L, null, %L::jsonb)',
  pg_temp.id('orgB'), 'UPDATE', 'order', '{"forged":true}'), 'permission denied');
reset role;
select pg_temp.assert_eq((select count(*) from public.audit_logs where org_id = pg_temp.id('orgB') and metadata->>'forged' = 'true'), 0, 'no forged audit rows');
-- The audit triggers (SECURITY DEFINER) still log a real change made by staff.
select pg_temp.act_as(pg_temp.id('secB'));
update public.patients set first_name = 'Ficticio2' where id = pg_temp.id('patientB');
reset role;
select pg_temp.assert_true((select count(*) > 0 from public.audit_logs where org_id = pg_temp.id('orgB') and entity_id = pg_temp.id('patientB')), 'audit trigger still logs');
rollback to savepoint s;

-- ===========================================================================
-- 5. rpc/create_lab_order/patient-org-unbound
--    rpc/create_lab_order/client-price-and-exemption-trusted
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, 40, null, false, %L::jsonb, %L)',
  pg_temp.id('orgA'), pg_temp.id('patientB'), '[{"test_name":"x","price":1}]', pg_temp.id('adminA')), 'INVALID_PATIENT');
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, 40, 200, true, %L::jsonb, %L)',
  pg_temp.id('orgA'), pg_temp.id('patientA'), '[{"test_name":"Perfil caro","price":100}]', pg_temp.id('affA')), 'EXEMPTION_NOT_ALLOWED');
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, 40, null, false, %L::jsonb, %L)',
  pg_temp.id('orgA'), pg_temp.id('patientA'), '[{"test_name":"Perfil caro","price":100},{"test_name":"Descuento","price":-100}]', pg_temp.id('affA')), 'INVALID_PRICE');
-- Direct INSERT path is closed for staff and affiliates alike.
select pg_temp.expect_error(format('insert into public.orders (org_id, patient_id, payment_status, total_amount, is_exempted, created_by) values (%L, %L, %L, 0, true, %L)',
  pg_temp.id('orgA'), pg_temp.id('patientA'), 'paid', pg_temp.id('affA')), 'row-level security');
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(format('insert into public.orders (org_id, patient_id, created_by) values (%L, %L, %L)',
  pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('secA')), 'row-level security');
-- Staff can still exempt; affiliates can still order normally.
select pg_temp.assert_true((public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, null, true,
  '[{"test_name":"Cortesia","price":5}]'::jsonb, pg_temp.id('secA'))->>'technicalCode') = 'ORDER_CREATED', 'staff exemption works');
reset role;
select pg_temp.assert_true((select payment_status = 'pending' and total_amount = 100 and not is_exempted from public.orders where id = pg_temp.id('orderAff')), 'affiliate order is pending at full price');
rollback to savepoint s;

-- ===========================================================================
-- 6. erp-invoice-foreign-refs-not-org-bound
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('update public.invoices set order_id = %L, patient_id = %L where id = %L',
  pg_temp.id('orderB1'), pg_temp.id('patientB'), pg_temp.id('invoiceA')), 'ERP_CROSS_ORG_REFERENCE');
select pg_temp.expect_error(format('update public.invoices set patient_id = %L where id = %L',
  pg_temp.id('patientB'), pg_temp.id('invoiceA')), 'ERP_CROSS_ORG_REFERENCE');
reset role;
-- A B invoice (B had ERP earlier) must not be schedulable from A.
insert into public.invoices (id, org_id, invoice_number, invoice_seq, order_id, patient_id, subtotal_usd, total_usd, amount_paid_usd, balance_due_usd, status, created_by)
values (gen_random_uuid(), pg_temp.id('orgB'), '', 0, pg_temp.id('orderB2'), pg_temp.id('patientB'), 10, 10, 0, 10, 'issued', pg_temp.id('adminB'));
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, due_date) values (%L, %L, 1, 5, current_date)',
  pg_temp.id('orgA'), (select id from public.invoices where order_id = pg_temp.id('orderB2'))), 'ERP_CROSS_ORG_REFERENCE');
-- Own schedule still works.
insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, due_date)
values (pg_temp.id('orgA'), pg_temp.id('invoiceA'), 1, 10, current_date + 30);
reset role;

-- Defense in depth: even with a pre-existing cross-org link (triggers bypassed),
-- the AR report hides the foreign patient and payments do not touch B's order.
set local session_replication_role = replica;
update public.invoices set order_id = pg_temp.id('orderB1'), patient_id = pg_temp.id('patientB') where id = pg_temp.id('invoiceA');
set local session_replication_role = origin;
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.assert_true(
  not (public.get_accounts_receivable_report(pg_temp.id('orgA'))::text like '%AUDIT-B-2%'), 'AR report does not leak B patient');
select public.register_payment(pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('accZelle'), 'amount', 10, 'reference_number', 'AUDIT-1')));
reset role;
select pg_temp.assert_true((select payment_status = 'unpaid' from public.orders where id = pg_temp.id('orderB1')), 'B order payment status untouched');
rollback to savepoint s;

-- ===========================================================================
-- 7a. rls/organizations/lab-admin-update-operator-flags-no-column-guard
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.expect_error(format('update public.organizations set has_erp_module = true where id = %L', pg_temp.id('orgB')), 'ORG_FLAGS_FORBIDDEN');
select pg_temp.expect_error(format('update public.organizations set subscription_active = true, is_active = true where id = %L', pg_temp.id('orgB')), 'ORG_FLAGS_FORBIDDEN');
-- Branding/contact edits stay allowed.
update public.organizations set primary_color = '#123456' where id = pg_temp.id('orgB');
reset role;
select pg_temp.assert_true((select primary_color = '#123456' and not has_erp_module and not is_active from public.organizations where id = pg_temp.id('orgB')), 'admin B edited branding only');
select pg_temp.act_as(pg_temp.id('superAdmin'));
update public.organizations set has_erp_module = true where id = pg_temp.id('orgB');
reset role;
select pg_temp.assert_true((select has_erp_module from public.organizations where id = pg_temp.id('orgB')), 'super admin toggles ERP');
rollback to savepoint s;

-- ===========================================================================
-- 7b. rls/organizations/anon-select-all-rows-all-columns
-- ===========================================================================
savepoint s;
select pg_temp.act_as_anon();
select pg_temp.expect_error('select name, rif, email, subscription_active, has_erp_module from public.organizations', 'permission denied');
select pg_temp.expect_error('select rif from public.organizations', 'permission denied');
select pg_temp.expect_error('select has_erp_module from public.organizations', 'permission denied');
select pg_temp.expect_error('select * from public.organizations', 'permission denied');
select pg_temp.assert_true((select name = 'Audit Test B' from public.get_public_org_brand(pg_temp.id('orgB'))), 'anon gets branding for one org');
-- The query the live `main` portal still runs (useOrgPatientPortal).
select pg_temp.assert_true((
  select name = 'Audit Test B' from public.organizations where id = pg_temp.id('orgB')
), 'legacy anon branding select still works');
select pg_temp.assert_eq((
  select count(*) from (
    select name, logo_url, primary_color, secondary_color, email, phone, address, report_template
    from public.organizations where id = pg_temp.id('orgB')
  ) q
), 1, 'legacy anon branding columns readable');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.assert_eq((select count(*) from public.organizations where id in (pg_temp.id('orgA'), pg_temp.id('orgB'))), 1, 'staff see only their own org');
select pg_temp.act_as(pg_temp.id('superAdmin'));
select pg_temp.assert_eq((select count(*) from public.organizations where id in (pg_temp.id('orgA'), pg_temp.id('orgB'))), 2, 'super admin sees all orgs');
reset role;
rollback to savepoint s;

-- ===========================================================================
-- 8. rls/orders+order_items/update-no-role-transition-or-column-guard
-- ===========================================================================
savepoint s;
-- A. Secretary cannot approve/sign or mark consumption.
select pg_temp.act_as(pg_temp.id('secB'));
select pg_temp.expect_error(format($q$update public.orders set status = 'completada', completed_at = now(), firma_name = 'Dummy Bio', firma_url = 'https://example.invalid/forged-firma.png' where id = %L$q$,
  pg_temp.id('orderB1')), 'ORDER_SIGN_FORBIDDEN');
select pg_temp.expect_error(format('update public.orders set consumption_confirmed_at = now() where id = %L', pg_temp.id('orderB1')), 'ORDER_RPC_ONLY_FIELDS');
-- Secretary keeps ordinary workflow edits.
update public.orders set notes = 'audit note' where id = pg_temp.id('orderB1');
update public.order_items set results_data = '{"value":"100"}' where id = pg_temp.id('itemB1');
-- B. Bioanalyst signs; a forged signature is replaced with the signer's own profile.
select pg_temp.act_as(pg_temp.id('bioB'));
update public.orders set status = 'completada', completed_at = now(), firma_name = 'Dummy Bio', firma_url = 'https://example.invalid/forged-firma.png'
where id = pg_temp.id('orderB1');
reset role;
select pg_temp.assert_true((select status = 'completada' and firma_name = 'Bio B' and firma_url = 'https://example.invalid/bioB.png'
  and sello_url = 'https://example.invalid/selloB.png' from public.orders where id = pg_temp.id('orderB1')), 'signature taken from signer profile');
-- C. Results of a completed order are immutable, and it cannot be reopened.
select pg_temp.act_as(pg_temp.id('secB'));
select pg_temp.expect_error(format($q$update public.order_items set results_data = '{"value":"400"}' where id = %L$q$, pg_temp.id('itemB1')), 'ORDER_RESULTS_LOCKED');
select pg_temp.expect_error(format($q$update public.orders set status = 'por_aprobar' where id = %L$q$, pg_temp.id('orderB1')), 'ORDER_COMPLETED_LOCKED');
select pg_temp.act_as(pg_temp.id('bioB'));
select pg_temp.expect_error(format($q$update public.order_items set results_data = '{"value":"400"}' where id = %L$q$, pg_temp.id('itemB1')), 'ORDER_RESULTS_LOCKED');
-- D. Payment fields and item prices are lab_admin only.
select pg_temp.expect_error(format($q$update public.orders set payment_status = 'paid', total_amount = 0 where id = %L$q$, pg_temp.id('orderB2')), 'ORDER_PAYMENT_FORBIDDEN');
select pg_temp.act_as(pg_temp.id('secB'));
select pg_temp.expect_error(format($q$update public.orders set is_exempted = true where id = %L$q$, pg_temp.id('orderB2')), 'ORDER_PAYMENT_FORBIDDEN');
select pg_temp.expect_error(format('update public.order_items set price_at_order = 0 where order_id = %L', pg_temp.id('orderB2')), 'ORDER_PAYMENT_FORBIDDEN');
-- E. lab_admin settles affiliate orders (useMarkAffiliateOrdersPaid).
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format($q$update public.orders set payment_status = 'paid' where id = %L$q$, pg_temp.id('orderAff')), 'ORDER_PAYMENT_FORBIDDEN');
select pg_temp.act_as(pg_temp.id('adminA'));
update public.orders set payment_status = 'paid' where id = pg_temp.id('orderAff') and created_by = pg_temp.id('affA');
reset role;
select pg_temp.assert_true((select payment_status = 'paid' from public.orders where id = pg_temp.id('orderAff')), 'lab_admin settles affiliate order');
-- F. ERP labs complete only through confirm_order_consumption, which still works
--    and also ignores a forged signature payload.
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format($q$update public.orders set status = 'completada' where id = %L$q$, pg_temp.id('orderA')), 'ORDER_COMPLETION_REQUIRES_CONSUMPTION');
select public.confirm_order_consumption(pg_temp.id('orderA'), '[]'::jsonb, '{"firma_name":"Dummy Bio","firma_url":"https://example.invalid/forged-firma.png"}'::jsonb);
reset role;
select pg_temp.assert_true((select status = 'completada' and consumption_confirmed_at is not null and firma_name = 'Bio A'
  and firma_url = 'https://example.invalid/bioA.png' from public.orders where id = pg_temp.id('orderA')), 'RPC completion with profile signature');
-- G. Payments still sync orders.payment_status through the balance trigger.
select pg_temp.act_as(pg_temp.id('secA'));
select public.register_payment(pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('accZelle'), 'amount', 10, 'reference_number', 'AUDIT-2')));
reset role;
select pg_temp.assert_true((select payment_status = 'paid' from public.orders where id = pg_temp.id('orderA')), 'payment syncs order status');
-- H. The anonymous portal never sees a secretary-forged completion (A above failed),
--    so only the bioanalyst-signed order is completed in B.
select pg_temp.assert_eq((select count(*) from public.orders where org_id = pg_temp.id('orgB') and status = 'completada'), 1, 'only the signed order completed');
rollback to savepoint s;

-- ===========================================================================
-- 9. erp-finance-read-policy-any-org-member
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('secA'));
select public.register_payment(pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('accZelle'), 'amount', 5, 'reference_number', 'AUDIT-3')));
reset role;
insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, due_date)
values (pg_temp.id('orgA'), pg_temp.id('invoiceA'), 1, 5, current_date + 30);

create function pg_temp.finance_rows() returns numeric language sql as $$
  select (select count(*) from public.invoices where org_id = pg_temp.id('orgA'))
       + (select count(*) from public.payments where org_id = pg_temp.id('orgA'))
       + (select count(*) from public.payment_schedules where org_id = pg_temp.id('orgA'))
       + (select count(*) from public.bank_accounts where org_id = pg_temp.id('orgA'))
$$;

select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_eq(pg_temp.finance_rows(), 0, 'affiliate sees no finance rows');
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.assert_eq(pg_temp.finance_rows(), 0, 'bioanalyst sees no finance rows');
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.assert_true(pg_temp.finance_rows() >= 4, 'secretary sees finance rows');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.assert_true(pg_temp.finance_rows() >= 4, 'lab_admin sees finance rows');
reset role;
-- With the module off, the read policies hide finance rows. (lab_admin still
-- reaches them through the pre-existing "ERP admins manage ..." ALL policies.)
update public.organizations set has_erp_module = false where id = pg_temp.id('orgA');
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.assert_eq(pg_temp.finance_rows(), 0, 'non-ERP org hides finance rows');
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_eq(pg_temp.finance_rows(), 0, 'non-ERP org hides finance rows');
reset role;
rollback to savepoint s;

do $$ begin raise notice 'Audit authz fixes passed'; end $$;

rollback;
