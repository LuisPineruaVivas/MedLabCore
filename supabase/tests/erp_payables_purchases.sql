-- Test for migration 20261108010000_erp_payables_and_purchases (ERP finances, phase 2).
-- Rolled back. Prints "ERP payables and purchases passed".
--   npm run test:db -- erp_payables_purchases

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    if sqlerrm !~ p_pattern then
      raise exception 'Expected error matching "%" but got "%" for: %', p_pattern, sqlerrm, p_sql;
    end if;
  end;
  if not v_failed then
    raise exception 'Expected error matching "%" but statement succeeded: %', p_pattern, p_sql;
  end if;
end;
$$;

create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'Assertion failed: %', p_label; end if;
end;
$$;

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create temp table ids (k text primary key, v uuid);
insert into ids values
  ('org', gen_random_uuid()), ('other_org', gen_random_uuid()), ('admin', gen_random_uuid()), ('sec', gen_random_uuid()),
  ('bio', gen_random_uuid()), ('other_admin', gen_random_uuid()), ('usd', gen_random_uuid()), ('ves', gen_random_uuid()),
  ('item', gen_random_uuid());
grant select, insert on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.run(p_sql text) returns void language plpgsql as $$ begin execute p_sql; end $$;
create function pg_temp.cat(p_name text) returns uuid language sql as $$
  select id from public.finance_categories where org_id is null and name = p_name
$$;
grant execute on function pg_temp.cat(text) to authenticated;
create function pg_temp.balance(p_account text) returns numeric language sql as $$
  select (b->>'balance')::numeric from jsonb_array_elements(public.get_account_balances(pg_temp.id('org'))) b
  where (b->>'account_id')::uuid = pg_temp.id(p_account)
$$;
create function pg_temp.payable(p_key text) returns public.payables language sql as $$
  select * from public.payables where id = pg_temp.id(p_key)
$$;

insert into public.organizations (id, name, has_erp_module) values
  (pg_temp.id('org'), 'Payables Lab', true), (pg_temp.id('other_org'), 'Other Payables Lab', true);
insert into auth.users (id, email) select v, k || '@payables.local' from ids where k in ('admin', 'sec', 'bio', 'other_admin');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@payables.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@payables.local'),
  (pg_temp.id('bio'), pg_temp.id('org'), 'bioanalyst', 'Bio', 'bio@payables.local'),
  (pg_temp.id('other_admin'), pg_temp.id('other_org'), 'lab_admin', 'Other', 'other@payables.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.bank_accounts (id, org_id, name, method_type, currency, opening_balance, opening_date) values
  (pg_temp.id('usd'), pg_temp.id('org'), 'Caja USD', 'cash', 'USD', 500, current_date - 5),
  (pg_temp.id('ves'), pg_temp.id('org'), 'Banco Bs', 'bank_transfer', 'VES', 10000, current_date - 5);
insert into public.exchange_rate_history (org_id, from_currency, to_currency, rate, effective_date) values (pg_temp.id('org'), 'USD', 'VES', 40, current_date);
insert into public.items (id, org_id, name, unit_of_measure) values (pg_temp.id('item'), pg_temp.id('org'), 'Tubo EDTA', 'units');

-- 1. Initial stock moves no money; a bioanalyst's purchase becomes a payable; it cannot pay from an account.
select pg_temp.act_as(pg_temp.id('bio'));
select public.register_purchase(pg_temp.id('org'), pg_temp.id('item'), 10, 0.5, null, null, null, null, null, true);
insert into ids select 'p_bio', (public.register_purchase(pg_temp.id('org'), pg_temp.id('item'), 20, 0.5, 'Distribuidora X', 'FAC-1', null, null, null, false, null, null, current_date + 15)->>'payable_id')::uuid;
select pg_temp.expect_error(format('select public.register_purchase(%L, %L, 1, 1, null, null, null, null, null, false, %L)', pg_temp.id('org'), pg_temp.id('item'), pg_temp.id('usd')), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.get_payables_summary(%L)', pg_temp.id('org')), 'ERP_PERMISSION_DENIED');
reset role;
select pg_temp.assert_true((select count(*) = 0 from public.account_movements where org_id = pg_temp.id('org')), 'no money moved yet');
select pg_temp.assert_true((select amount = 10 and currency = 'USD' and status = 'pending' and payee = 'Distribuidora X'
  and description = 'Compra: 20 × Tubo EDTA (Distribuidora X)' and reference_number = 'FAC-1' and inventory_transaction_id is not null
  and due_date = current_date + 15 from pg_temp.payable('p_bio')), 'purchase payable: 20 × 0.5 = 10 USD');
select pg_temp.assert_true((select current_stock = 30 from public.items where id = pg_temp.id('item')), 'stock still updated');

-- 2. Admin buys paying from a Bs account at the given rate: an expense linked to the Kardex entry.
select pg_temp.act_as(pg_temp.id('admin'));
select public.register_purchase(pg_temp.id('org'), pg_temp.id('item'), 10, 1, null, null, null, null, null, false, pg_temp.id('ves'), 40);
select pg_temp.assert_true(pg_temp.balance('ves') = 9600, 'Bs account paid 10 USD × 40 = 400');
reset role;
select pg_temp.assert_true((select amount_usd = 10 and inventory_transaction_id is not null and category_id = pg_temp.cat('Insumos y reactivos')
  from public.account_movements where org_id = pg_temp.id('org') and account_id = pg_temp.id('ves')), 'purchase expense categorised and linked');
select pg_temp.assert_true((select count(*) = 1 from public.payables where org_id = pg_temp.id('org')), 'paid purchase leaves no payable');
select pg_temp.expect_error(format('select public.register_purchase(%L, %L, 1, 1, null, null, null, null, null, true, %L)', pg_temp.id('org'), pg_temp.id('item'), pg_temp.id('usd')), 'INITIAL_STOCK|ERP_PERMISSION');

-- 3. Secretary creates a bill in Bs and pays it in two parts, one from the USD account.
select pg_temp.act_as(pg_temp.id('sec'));
insert into ids select 'p_light', (public.create_payable(pg_temp.id('org'), pg_temp.cat('Servicios (luz, agua, internet, teléfono)'), 'Luz noviembre', 800, 'VES', current_date - 1, 'Corpoelec')->>'payable_id')::uuid;
select pg_temp.expect_error(format('select public.create_payable(%L, %L, %L, 10)', pg_temp.id('org'), pg_temp.cat('Otros ingresos'), 'x x'), 'INVALID_CATEGORY');
select pg_temp.run(format('select public.pay_payable(%L, %L, 300)', pg_temp.id('p_light'), pg_temp.id('ves')));
select pg_temp.run(format('select public.pay_payable(%L, %L, 5, null, 40)', pg_temp.id('p_light'), pg_temp.id('usd')));
reset role;
select pg_temp.assert_true((select amount_paid = 500 and status = 'partial' from pg_temp.payable('p_light')), 'paid 300 Bs + 5 USD × 40 = 500 of 800');
select pg_temp.assert_true(
  (select (s->>'pending')::numeric = 300 and (s->>'overdue')::numeric = 300 from jsonb_array_elements(public.get_payables_summary(pg_temp.id('org'))) s where s->>'currency' = 'VES'),
  'summary: 300 Bs pending and overdue');
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format('select public.pay_payable(%L, %L, 301)', pg_temp.id('p_light'), pg_temp.id('ves')), 'PAYMENT_EXCEEDS_BALANCE');
select pg_temp.run(format('select public.pay_payable(%L, %L, 300)', pg_temp.id('p_light'), pg_temp.id('ves')));
select pg_temp.expect_error(format('select public.pay_payable(%L, %L, 1)', pg_temp.id('p_light'), pg_temp.id('ves')), 'PAYABLE_NOT_PAYABLE');
select pg_temp.expect_error(format('select public.cancel_payable(%L, %L)', pg_temp.id('p_bio'), 'x'), 'ERP_PERMISSION_DENIED');
reset role;
select pg_temp.assert_true((select status = 'paid' and amount_paid = 800 from pg_temp.payable('p_light')), 'bill paid');

-- 4. Voiding a payment reopens the bill.
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.run(format('select public.void_account_movement(%L, %L)',
  (select id from public.account_movements where payable_id = pg_temp.id('p_light') and currency = 'USD'), 'error'));
reset role;
select pg_temp.assert_true((select status = 'partial' and amount_paid = 600 from pg_temp.payable('p_light')), 'voided payment reopens the bill');

-- 5. Admin pays the purchase payable in USD, then cancels nothing paid; cancel rules.
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.run(format('select public.pay_payable(%L, %L, 4)', pg_temp.id('p_bio'), pg_temp.id('usd')));
select pg_temp.assert_true(pg_temp.balance('usd') = 496, 'USD account paid 4');
select pg_temp.run(format('select public.cancel_payable(%L, %L)', pg_temp.id('p_bio'), 'el proveedor regaló el resto'));
select pg_temp.expect_error(format('select public.pay_payable(%L, %L, 1)', pg_temp.id('p_bio'), pg_temp.id('usd')), 'PAYABLE_NOT_PAYABLE');
select pg_temp.expect_error(format('select public.cancel_payable(%L, %L)', pg_temp.id('p_bio'), 'x'), 'PAYABLE_ALREADY_CANCELLED');
reset role;
select pg_temp.assert_true((select status = 'cancelled' and amount_paid = 4 from pg_temp.payable('p_bio')), 'cancelled keeps what was paid');

-- 6. No direct writes; other labs and bioanalysts cannot read bills.
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect_error(format('insert into public.payables (org_id, category_id, description, amount, currency, created_by) values (%L, %L, %L, 1, %L, %L)',
  pg_temp.id('org'), pg_temp.cat('Alquiler'), 'xx', 'USD', pg_temp.id('admin')), 'row-level security');
select pg_temp.run(format('update public.payables set amount = 1 where id = %L', pg_temp.id('p_light')));
reset role;
select pg_temp.assert_true((select amount = 800 from pg_temp.payable('p_light')), 'direct update has no effect');
select pg_temp.act_as(pg_temp.id('bio'));
select pg_temp.assert_true((select count(*) = 0 from public.payables), 'bioanalyst reads no bills');
select pg_temp.act_as(pg_temp.id('other_admin'));
select pg_temp.assert_true((select count(*) = 0 from public.payables), 'other lab reads no bills');
select pg_temp.expect_error(format('select public.pay_payable(%L, %L, 1)', pg_temp.id('p_light'), pg_temp.id('usd')), 'ERP_PERMISSION_DENIED');
reset role;

do $$ begin raise notice 'ERP payables and purchases passed'; end $$;
rollback;
