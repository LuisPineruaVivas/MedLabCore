-- Integration smoke test for the ERP RPCs (cash register, payments, schedules, inventory).
-- Runs entirely inside a transaction and rolls back, so it leaves no data behind.
--
-- Against the local Supabase stack (after the ERP migrations are applied, or prepend them):
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/erp_rpcs_smoke.sql
-- Any failed assertion aborts with an error; success prints "ERP smoke test passed".

begin;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

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

-- ---------------------------------------------------------------------------
-- Fixtures: two ERP labs (A, B) and one without the module (C)
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()), ('orgC', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('secA', gen_random_uuid()), ('bioA', gen_random_uuid()),
  ('adminB', gen_random_uuid()), ('adminC', gen_random_uuid());
grant select on ids to authenticated, anon;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, has_erp_module) values
  (pg_temp.id('orgA'), 'ERP Test A', true),
  (pg_temp.id('orgB'), 'ERP Test B', true),
  (pg_temp.id('orgC'), 'ERP Test C', false);

insert into auth.users (id, email)
select v, k || '@erp-test.local' from ids where k in ('adminA', 'secA', 'bioA', 'adminB', 'adminC');

insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@erp-test.local'),
  (pg_temp.id('secA'), pg_temp.id('orgA'), 'secretary', 'Secretaria A', 'secA@erp-test.local'),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@erp-test.local'),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@erp-test.local'),
  (pg_temp.id('adminC'), pg_temp.id('orgC'), 'lab_admin', 'Admin C', 'adminC@erp-test.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name;

insert into public.user_roles (user_id, role) values
  (pg_temp.id('adminA'), 'lab_admin'), (pg_temp.id('secA'), 'secretary'), (pg_temp.id('bioA'), 'bioanalyst'),
  (pg_temp.id('adminB'), 'lab_admin'), (pg_temp.id('adminC'), 'lab_admin');

select pg_temp.act_as(pg_temp.id('adminA'));
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (gen_random_uuid(), pg_temp.id('orgA'), 'V-0001', 'Paciente', 'Prueba', '1990-01-01', 'femenino', pg_temp.id('adminA'));
insert into ids select 'patientA', id from public.patients where org_id = pg_temp.id('orgA');

insert into public.exchange_rate_history (org_id, from_currency, to_currency, rate, effective_date)
values (pg_temp.id('orgA'), 'USD', 'VES', 40, current_date);

insert into public.bank_accounts (id, org_id, name, method_type, currency) values
  (gen_random_uuid(), pg_temp.id('orgA'), 'Efectivo USD', 'cash', 'USD'),
  (gen_random_uuid(), pg_temp.id('orgA'), 'Zelle', 'zelle', 'USD'),
  (gen_random_uuid(), pg_temp.id('orgA'), 'Efectivo Bs', 'cash', 'VES');
insert into ids select 'acc:' || name, id from public.bank_accounts where org_id = pg_temp.id('orgA');

-- Order of $100 created by the secretary -> invoice issued automatically.
select pg_temp.act_as(pg_temp.id('secA'));
select public.create_lab_order(
  pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, 4000, false,
  '[{"test_name":"Hematología","price":100}]'::jsonb, pg_temp.id('secA'));
insert into ids select 'invoiceA', id from public.invoices where org_id = pg_temp.id('orgA');
select pg_temp.assert_eq((select balance_due_usd from public.invoices where id = pg_temp.id('invoiceA')), 100, 'invoice created with full balance');

-- ---------------------------------------------------------------------------
-- Cash register
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('select public.open_cash_session(%L, 0, 0, null)', pg_temp.id('orgA')), 'ERP_PERMISSION_DENIED');

select pg_temp.act_as(pg_temp.id('adminC'));
select pg_temp.expect_error(format('select public.open_cash_session(%L, 0, 0, null)', pg_temp.id('orgC')), 'ERP_MODULE_DISABLED');

select pg_temp.act_as(pg_temp.id('secA'));
select public.open_cash_session(pg_temp.id('orgA'), 20, 100, 'Turno mañana');
insert into ids select 'sessionA', id from public.cash_register_sessions where org_id = pg_temp.id('orgA') and status = 'open';
select pg_temp.expect_error(format('select public.open_cash_session(%L, 0, 0, null)', pg_temp.id('orgA')), 'CASH_SESSION_ALREADY_OPEN');

-- $30 cash + $20 Zelle + Bs 400 cash (= $10) -> $60 paid, $40 pending.
select public.register_payment(pg_temp.id('orgA'), pg_temp.id('invoiceA'), jsonb_build_array(
  jsonb_build_object('bank_account_id', pg_temp.id('acc:Efectivo USD'), 'amount', 30),
  jsonb_build_object('bank_account_id', pg_temp.id('acc:Zelle'), 'amount', 20, 'reference_number', 'ZL-1'),
  jsonb_build_object('bank_account_id', pg_temp.id('acc:Efectivo Bs'), 'amount', 400)
));
select pg_temp.assert_eq((select balance_due_usd from public.invoices where id = pg_temp.id('invoiceA')), 40, 'balance after mixed payment');
select pg_temp.assert_eq((select count(*) from public.payments where cash_session_id = pg_temp.id('sessionA')), 3, 'payments linked to open session');
select pg_temp.assert_eq((select count(*) from public.payments where invoice_id = pg_temp.id('invoiceA') and method_type = 'zelle'), 1, 'method_type snapshot');

select pg_temp.expect_error(format(
  'select public.register_payment(%L, %L, %L::jsonb)', pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('acc:Efectivo USD'), 'amount', 41))), 'PAYMENT_EXCEEDS_BALANCE');

do $$
declare v jsonb := public.get_cash_session_summary(pg_temp.id('sessionA'));
begin
  perform pg_temp.assert_eq((v->'USD'->>'cash_expected')::numeric, 50, 'USD cash expected = fund 20 + cash 30');
  perform pg_temp.assert_eq((v->'USD'->>'electronic')::numeric, 20, 'USD electronic = Zelle 20');
  perform pg_temp.assert_eq((v->'VES'->>'cash_expected')::numeric, 500, 'VES cash expected = fund 100 + cash 400');
end $$;

-- Installments: another lab's admin cannot touch this invoice.
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.expect_error(format(
  'select public.create_payment_schedule(%L, %L, %L::jsonb)', pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  '[{"amount_due_usd":40,"due_date":"2030-01-01"}]'), 'ERP_PERMISSION_DENIED');

select pg_temp.act_as(pg_temp.id('adminA'));
select public.create_payment_schedule(pg_temp.id('orgA'), pg_temp.id('invoiceA'),
  '[{"amount_due_usd":20,"due_date":"2030-01-01"},{"amount_due_usd":20,"due_date":"2030-02-01"}]'::jsonb);
select pg_temp.assert_eq((select count(*) from public.payment_schedules where invoice_id = pg_temp.id('invoiceA')), 3, 'previous payments + 2 installments');
select pg_temp.assert_eq((select count(*) from public.payment_schedules where invoice_id = pg_temp.id('invoiceA') and status = 'pending'), 2, 'new installments start pending');

-- Voiding while the session is open restores the balance.
select public.void_payment((select id from public.payments where invoice_id = pg_temp.id('invoiceA') and method_type = 'zelle'), 'Referencia duplicada');
select pg_temp.assert_eq((select balance_due_usd from public.invoices where id = pg_temp.id('invoiceA')), 60, 'balance after void');

-- Close: counted $50 and Bs 490 -> USD balanced, VES short by 10.
select pg_temp.act_as(pg_temp.id('secA'));
select public.close_cash_session(pg_temp.id('sessionA'), '{"USD": 50, "VES": 490}'::jsonb, 'Cierre de prueba');
do $$
declare v jsonb := (select difference from public.cash_register_sessions where id = pg_temp.id('sessionA'));
begin
  perform pg_temp.assert_eq((v->'USD'->>'difference')::numeric, 0, 'USD difference');
  perform pg_temp.assert_eq((v->'VES'->>'difference')::numeric, -10, 'VES difference');
end $$;

select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.void_payment(%L, %L)',
  (select id from public.payments where invoice_id = pg_temp.id('invoiceA') and not is_void limit 1), 'x'), 'CASH_SESSION_CLOSED');

select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(format('select public.review_cash_session(%L, null)', pg_temp.id('sessionA')), 'ERP_PERMISSION_DENIED');
select pg_temp.act_as(pg_temp.id('adminA'));
select public.review_cash_session(pg_temp.id('sessionA'), 'OK');
select pg_temp.assert_eq((select count(*) from public.cash_register_sessions where id = pg_temp.id('sessionA') and status = 'reviewed'), 1, 'session reviewed');

-- ---------------------------------------------------------------------------
-- Inventory / Kardex
-- ---------------------------------------------------------------------------
-- Through RLS, as the bioanalyst: stock sent by the client is ignored.
select pg_temp.act_as(pg_temp.id('bioA'));
set local role authenticated;
insert into public.items (org_id, code, name, unit_of_measure, min_stock, current_stock, unit_cost)
values (pg_temp.id('orgA'), 'R-001', 'Tubo morado EDTA', 'units', 50, 999, 9);
reset role;
insert into ids select 'itemA', id from public.items where org_id = pg_temp.id('orgA') and code = 'R-001';
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemA')), 0, 'new item starts with zero stock');

-- Another lab cannot see the item.
select pg_temp.act_as(pg_temp.id('adminB'));
set local role authenticated;
select pg_temp.assert_eq((select count(*) from public.items where id = pg_temp.id('itemA')), 0, 'RLS isolates items by lab');
reset role;

select pg_temp.act_as(pg_temp.id('bioA'));
select public.register_purchase(pg_temp.id('orgA'), pg_temp.id('itemA'), 100, 0.50, null, null, 'L-1', null, null, true);
select pg_temp.expect_error(format('select public.register_purchase(%L, %L, 1, 1, null, null, null, null, null, true)', pg_temp.id('orgA'), pg_temp.id('itemA')), 'INITIAL_STOCK_ALREADY_SET');
select public.register_purchase(pg_temp.id('orgA'), pg_temp.id('itemA'), 50, 0.60, 'Proveedor X', 'FAC-99', 'L-2', '2030-12-31', null, false);
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemA')), 150, 'stock after purchases');
select pg_temp.assert_eq((select unit_cost from public.items where id = pg_temp.id('itemA')), 0.5333, 'WAC after purchases');

select public.register_adjustment(pg_temp.id('orgA'), pg_temp.id('itemA'), 'out', 10, 'Rotura');
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemA')), 140, 'stock after adjustment');
select pg_temp.assert_eq((select unit_cost from public.items where id = pg_temp.id('itemA')), 0.5333, 'WAC unchanged by outflow');
select pg_temp.assert_eq((select total_value from public.items where id = pg_temp.id('itemA')), 74.662, 'inventory value');
select pg_temp.assert_eq((select count(*) from public.inventory_transactions where item_id = pg_temp.id('itemA')), 3, 'Kardex rows');

select pg_temp.expect_error(format('select public.register_adjustment(%L, %L, %L, 1000, %L)', pg_temp.id('orgA'), pg_temp.id('itemA'), 'out', 'x'), 'INSUFFICIENT_STOCK');
select pg_temp.expect_error(format('select public.register_adjustment(%L, %L, %L, 1, %L)', pg_temp.id('orgA'), pg_temp.id('itemA'), 'out', ' '), 'ADJUSTMENT_REASON_REQUIRED');
select pg_temp.expect_error(format('update public.items set current_stock = 1 where id = %L', pg_temp.id('itemA')), 'ITEM_STOCK_READ_ONLY');
select pg_temp.expect_error(format('update public.inventory_transactions set quantity = 1 where item_id = %L', pg_temp.id('itemA')), 'INVENTORY_TRANSACTIONS_IMMUTABLE');

-- Catalog edits (not stock) are still allowed.
update public.items set min_stock = 20, name = 'Tubo morado EDTA 4ml' where id = pg_temp.id('itemA');

select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(format('select public.register_purchase(%L, %L, 1, 1)', pg_temp.id('orgA'), pg_temp.id('itemA')), 'ERP_PERMISSION_DENIED');

-- ---------------------------------------------------------------------------
-- Recipes (BOM) and confirmed consumption
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('adminA'));
insert into public.test_templates (id, org_id, name, category, base_price, schema, is_active)
values (gen_random_uuid(), pg_temp.id('orgA'), 'Hematología ERP test', 'Hematología', 10, '{"sections":[]}', true);
insert into ids select 'templateA', id from public.test_templates where name = 'Hematología ERP test';

insert into public.items (id, org_id, code, name, unit_of_measure) values (gen_random_uuid(), pg_temp.id('orgA'), 'R-002', 'Lanceta', 'units');
insert into ids select 'itemB', id from public.items where org_id = pg_temp.id('orgA') and code = 'R-002';
select public.register_purchase(pg_temp.id('orgA'), pg_temp.id('itemB'), 10, 0.10, null, null, null, null, null, true);

-- Only lab admins edit recipes (RLS), and a recipe cannot point to another lab's supply.
select pg_temp.act_as(pg_temp.id('bioA'));
set local role authenticated;
select pg_temp.expect_error(format('insert into public.test_materials (org_id, template_id, item_id) values (%L, %L, %L)',
  pg_temp.id('orgA'), pg_temp.id('templateA'), pg_temp.id('itemA')), 'row-level security');
reset role;
select pg_temp.expect_error(format('insert into public.test_materials (org_id, template_id, item_id) values (%L, %L, %L)',
  pg_temp.id('orgB'), pg_temp.id('templateA'), pg_temp.id('itemA')), 'ITEM_NOT_FOUND');

select pg_temp.act_as(pg_temp.id('adminA'));
set local role authenticated;
insert into public.test_materials (org_id, template_id, item_id, quantity_per_test) values
  (pg_temp.id('orgA'), pg_temp.id('templateA'), pg_temp.id('itemA'), 1),
  (pg_temp.id('orgA'), pg_temp.id('templateA'), pg_temp.id('itemB'), 2);
reset role;

select pg_temp.act_as(pg_temp.id('secA'));
select public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, 400, false,
  jsonb_build_array(jsonb_build_object('test_name', 'Hematología ERP test', 'price', 10, 'template_id', pg_temp.id('templateA'))), pg_temp.id('secA'));
insert into ids select 'orderBom', o.id from public.orders o join public.order_items oi on oi.order_id = o.id where oi.template_id = pg_temp.id('templateA') order by o.created_at limit 1;
select public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, 400, false,
  jsonb_build_array(jsonb_build_object('test_name', 'Hematología ERP test', 'price', 10, 'template_id', pg_temp.id('templateA'))), pg_temp.id('secA'));
insert into ids select 'orderBom2', o.id from public.orders o join public.order_items oi on oi.order_id = o.id
  where oi.template_id = pg_temp.id('templateA') and o.id <> pg_temp.id('orderBom') limit 1;

select pg_temp.expect_error(format('select public.get_order_bom_preview(%L)', pg_temp.id('orderBom')), 'ERP_PERMISSION_DENIED');

select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.assert_eq(jsonb_array_length(public.get_order_bom_preview(pg_temp.id('orderBom'))), 2, 'BOM preview rows');

-- Recipe (1 tube + 2 lancets) plus one extra tube for a repeated sample.
select public.confirm_order_consumption(pg_temp.id('orderBom'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('itemA'), 'quantity', 1, 'order_item_id', (select id from public.order_items where order_id = pg_temp.id('orderBom') limit 1)),
  jsonb_build_object('item_id', pg_temp.id('itemB'), 'quantity', 2),
  jsonb_build_object('item_id', pg_temp.id('itemA'), 'quantity', 1, 'is_extra', true, 'reason', 'Muestra repetida')
), '{"firma_name": "Bio A"}'::jsonb);
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemA')), 138, 'tube stock after consumption');
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemB')), 8, 'lancet stock after consumption');
select pg_temp.assert_eq((select count(*) from public.orders where id = pg_temp.id('orderBom') and status = 'completada' and consumption_confirmed_at is not null and firma_name = 'Bio A'), 1, 'order completed with signature');
select pg_temp.assert_eq((select count(*) from public.invoice_consumptions where order_id = pg_temp.id('orderBom') and invoice_id is not null), 3, 'consumptions linked to invoice');
select pg_temp.assert_eq((select count(*) from public.inventory_transactions where reference_id = pg_temp.id('orderBom') and transaction_type = 'consumption' and invoice_consumption_id is not null), 3, 'Kardex consumption rows');

select pg_temp.expect_error(format('select public.confirm_order_consumption(%L, %L::jsonb)', pg_temp.id('orderBom'), '[]'), 'CONSUMPTION_ALREADY_CONFIRMED');

-- Not enough stock: nothing is discounted and the order stays open.
select pg_temp.expect_error(format('select public.confirm_order_consumption(%L, %L::jsonb)', pg_temp.id('orderBom2'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('itemB'), 'quantity', 100))), 'INSUFFICIENT_STOCK');
select pg_temp.assert_eq((select current_stock from public.items where id = pg_temp.id('itemB')), 8, 'stock untouched after failed confirmation');
select pg_temp.assert_eq((select count(*) from public.orders where id = pg_temp.id('orderBom2') and status <> 'completada'), 1, 'order still open after failed confirmation');

select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(format('select public.confirm_order_consumption(%L, %L::jsonb)', pg_temp.id('orderBom2'), '[]'), 'ERP_PERMISSION_DENIED');

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
-- One invoice 45 days past due and a supply below its minimum, to exercise aging and alerts.
update public.invoices set due_date = current_date - 45 where order_id = pg_temp.id('orderBom2');
update public.items set min_stock = 10 where id = pg_temp.id('itemB');

select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('select public.get_erp_financial_summary(%L)', pg_temp.id('orgA')), 'ERP_PERMISSION_DENIED');
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.expect_error(format('select public.get_erp_financial_summary(%L)', pg_temp.id('orgA')), 'ERP_PERMISSION_DENIED');

select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('select public.get_erp_financial_summary(%L, public.erp_local_date(now()), public.erp_local_date(now()) - 1)', pg_temp.id('orgA')), 'INVALID_DATE_RANGE');
do $$
declare v jsonb := public.get_erp_financial_summary(pg_temp.id('orgA'), public.erp_local_date(now()), public.erp_local_date(now()));
begin
  -- $30 cash + Bs 400 ($10); the $20 Zelle was voided.
  perform pg_temp.assert_eq((v->>'collected_usd')::numeric, 40, 'collected');
  perform pg_temp.assert_eq((v->>'collected_today_usd')::numeric, 40, 'collected today');
  perform pg_temp.assert_eq((v->>'payments_count')::numeric, 2, 'payments count');
  perform pg_temp.assert_eq((v->>'billed_usd')::numeric, 120, 'billed: $100 + $10 + $10');
  perform pg_temp.assert_eq((v->>'receivables_usd')::numeric, 80, 'receivables: 60 + 10 + 10');
  perform pg_temp.assert_eq((v->>'overdue_usd')::numeric, 10, 'overdue invoice');
  perform pg_temp.assert_eq((v->>'supply_cost_usd')::numeric, 1.2666, 'supply cost');
  perform pg_temp.assert_eq(jsonb_array_length(v->'by_method'), 2, 'collected by method');
  perform pg_temp.assert_eq(jsonb_array_length(v->'daily'), 1, 'one day in range');
end $$;

do $$
declare v jsonb := public.get_erp_profitability_report(pg_temp.id('orgA'), public.erp_local_date(now()), public.erp_local_date(now()));
begin
  perform pg_temp.assert_eq((v->>'orders_count')::numeric, 1, 'orders with confirmed consumption');
  perform pg_temp.assert_eq((v->>'revenue_usd')::numeric, 10, 'profitability revenue');
  perform pg_temp.assert_eq((v->>'supply_cost_usd')::numeric, 1.27, 'profitability cost');
  perform pg_temp.assert_eq((v->>'gross_profit_usd')::numeric, 8.73, 'gross profit');
  perform pg_temp.assert_eq((v->>'margin_pct')::numeric, 87.3, 'margin');
  perform pg_temp.assert_eq((v->>'unassigned_cost_usd')::numeric, 0.73, 'cost not tied to an exam');
  perform pg_temp.assert_eq((v->'by_test'->0->>'cost_usd')::numeric, 0.53, 'exam cost');
end $$;

-- Reports are for lab admins only; bioanalysts manage stock from Inventory.
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('select public.get_erp_inventory_summary(%L)', pg_temp.id('orgA')), 'ERP_PERMISSION_DENIED');

select pg_temp.act_as(pg_temp.id('adminA'));
do $$
declare v jsonb := public.get_erp_inventory_summary(pg_temp.id('orgA'), public.erp_local_date(now()), public.erp_local_date(now()));
begin
  perform pg_temp.assert_eq((v->>'active_items')::numeric, 2, 'active items');
  perform pg_temp.assert_eq((v->>'total_value_usd')::numeric, 74.40, 'inventory value');
  perform pg_temp.assert_eq(jsonb_array_length(v->'low_stock'), 1, 'low stock list');
  perform pg_temp.assert_eq((v->>'purchases_usd')::numeric, 81, 'purchases in range');
  perform pg_temp.assert_eq((v->>'consumption_usd')::numeric, 1.27, 'consumption in range');
  perform pg_temp.assert_eq((v->>'losses_usd')::numeric, 5.33, 'losses in range');
end $$;

select pg_temp.act_as(pg_temp.id('adminA'));
do $$
declare v jsonb := public.get_accounts_receivable_report(pg_temp.id('orgA'));
begin
  perform pg_temp.assert_eq((v->>'total_usd')::numeric, 80, 'aging total');
  perform pg_temp.assert_eq((v->'buckets'->>'current')::numeric, 70, 'not yet due');
  perform pg_temp.assert_eq((v->'buckets'->>'d31_60')::numeric, 10, '31-60 days');
  perform pg_temp.assert_eq((v->'invoices'->0->>'days_overdue')::numeric, 45, 'most overdue first');
end $$;

-- ---------------------------------------------------------------------------
-- Phase 8: tenant isolation, anonymous access, overdue status, retroactive invoices
-- ---------------------------------------------------------------------------
-- Another lab's admin sees none of lab A's ERP rows through RLS.
select pg_temp.act_as(pg_temp.id('adminB'));
set local role authenticated;
do $$
declare v_table text; v_count integer;
begin
  foreach v_table in array array['exchange_rate_history', 'bank_accounts', 'invoices', 'payments', 'payment_schedules',
                                  'cash_register_sessions', 'items', 'inventory_transactions', 'test_materials', 'invoice_consumptions'] loop
    execute format('select count(*) from public.%I where org_id = %L', v_table, pg_temp.id('orgA')) into v_count;
    if v_count <> 0 then raise exception 'Tenant leak: lab B sees % rows of lab A in %', v_count, v_table; end if;
  end loop;
end $$;
select pg_temp.expect_error(format('insert into public.bank_accounts (org_id, name) values (%L, %L)', pg_temp.id('orgA'), 'Intruso'), 'row-level security');
select pg_temp.expect_error('update public.invoice_sequences set last_value = 0', 'permission denied');
reset role;

set local role anon;
select pg_temp.expect_error('select count(*) from public.invoices', 'permission denied');
select pg_temp.expect_error(format('select public.get_exchange_rate(%L)', pg_temp.id('orgA')), 'permission denied');
reset role;

select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.assert_eq(public.get_exchange_rate(pg_temp.id('orgA')), null, 'exchange rate hidden from other labs');

-- Overdue: the daily job marks the invoice that is 45 days past due; a partial payment keeps it overdue.
select public.mark_overdue_invoices();
select pg_temp.assert_eq((select count(*) from public.invoices where order_id = pg_temp.id('orderBom2') and status = 'overdue'), 1, 'invoice marked overdue');
select pg_temp.assert_eq((select count(*) from public.invoices where id = pg_temp.id('invoiceA') and status = 'overdue'), 0, 'invoice not yet due stays as is');
select pg_temp.act_as(pg_temp.id('secA'));
select public.register_payment(pg_temp.id('orgA'), (select id from public.invoices where order_id = pg_temp.id('orderBom2')),
  jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('acc:Efectivo USD'), 'amount', 5)));
select pg_temp.assert_eq((select count(*) from public.invoices where order_id = pg_temp.id('orderBom2') and status = 'overdue' and balance_due_usd = 5), 1, 'still overdue after partial payment');

-- Retroactive invoices for an order created while the module was off.
update public.organizations set has_erp_module = false where id = pg_temp.id('orgA');
select public.create_lab_order(pg_temp.id('orgA'), pg_temp.id('patientA'), null, 40, 600, false,
  '[{"test_name":"Orden previa al ERP","price":15}]'::jsonb, pg_temp.id('secA'));
update public.organizations set has_erp_module = true where id = pg_temp.id('orgA');
insert into ids select 'legacyOrder', o.id from public.orders o
  where o.org_id = pg_temp.id('orgA') and not exists (select 1 from public.invoices i where i.order_id = o.id);

select pg_temp.expect_error(format('select public.erp_backfill_invoices(%L)', pg_temp.id('orgA')), 'ERP_PERMISSION_DENIED');
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.assert_eq((public.erp_backfill_invoices(pg_temp.id('orgA'))->>'orders')::numeric, 1, 'dry run counts orders without invoice');
select pg_temp.assert_eq((select count(*) from public.invoices where order_id = pg_temp.id('legacyOrder')), 0, 'dry run creates nothing');
select pg_temp.assert_eq((public.erp_backfill_invoices(pg_temp.id('orgA'), null, false)->>'orders')::numeric, 1, 'backfill creates one invoice');
select pg_temp.assert_eq((select count(*) from public.invoices i join public.orders o on o.invoice_id = i.id
  where i.order_id = pg_temp.id('legacyOrder') and i.balance_due_usd = 15 and i.status = 'issued'), 1, 'retroactive invoice linked with full balance');
select pg_temp.assert_eq((public.erp_backfill_invoices(pg_temp.id('orgA'), null, false)->>'orders')::numeric, 0, 'backfill is idempotent');

do $$ begin raise notice 'ERP smoke test passed'; end $$;

rollback;
