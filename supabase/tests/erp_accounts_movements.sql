-- Test for migration 20261108000000_erp_accounts_and_movements (ERP finances, phase 1).
-- Rolled back. Prints "ERP accounts and movements passed".
--   npm run test:db -- erp_accounts_movements

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
  ('bio', gen_random_uuid()), ('other_admin', gen_random_uuid()), ('patient', gen_random_uuid()), ('order', gen_random_uuid()),
  ('invoice', gen_random_uuid()), ('usd', gen_random_uuid()), ('ves', gen_random_uuid()), ('other_usd', gen_random_uuid()),
  ('session', gen_random_uuid());
grant select on ids to authenticated;
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

insert into public.organizations (id, name, has_erp_module) values
  (pg_temp.id('org'), 'Accounts Lab', true), (pg_temp.id('other_org'), 'Other Accounts Lab', true);
insert into auth.users (id, email) select v, k || '@accounts.local' from ids where k in ('admin', 'sec', 'bio', 'other_admin');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@accounts.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@accounts.local'),
  (pg_temp.id('bio'), pg_temp.id('org'), 'bioanalyst', 'Bio', 'bio@accounts.local'),
  (pg_temp.id('other_admin'), pg_temp.id('other_org'), 'lab_admin', 'Other', 'other@accounts.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'ACC-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by) values (pg_temp.id('order'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'));
insert into public.invoices (id, org_id, invoice_number, invoice_seq, order_id, patient_id, created_by, subtotal_usd, total_usd, balance_due_usd, amount_paid_usd, status)
values (pg_temp.id('invoice'), pg_temp.id('org'), 'ACC-1', 1, pg_temp.id('order'), pg_temp.id('patient'), pg_temp.id('admin'), 100, 100, 100, 0, 'issued');
insert into public.bank_accounts (id, org_id, name, method_type, currency, opening_balance, opening_date) values
  (pg_temp.id('usd'), pg_temp.id('org'), 'Caja USD', 'cash', 'USD', 100, current_date - 10),
  (pg_temp.id('ves'), pg_temp.id('org'), 'Banco Bs', 'bank_transfer', 'VES', 1000, current_date - 10),
  (pg_temp.id('other_usd'), pg_temp.id('other_org'), 'Otra caja', 'cash', 'USD', 0, current_date - 10);
insert into public.exchange_rate_history (org_id, from_currency, to_currency, rate, effective_date) values (pg_temp.id('org'), 'USD', 'VES', 40, current_date);

-- 1. Order payments count toward the account; payments before the opening date do not.
-- A closed cash session no longer blocks voiding a payment.
insert into public.cash_register_sessions (id, org_id, opened_by, operator_name, status) values (pg_temp.id('session'), pg_temp.id('org'), pg_temp.id('admin'), 'Admin', 'closed');
insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, bank_account_id, payment_method, created_by, payment_date, cash_session_id) values
  (pg_temp.id('org'), pg_temp.id('invoice'), 30, 'USD', 30, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now(), null),
  (pg_temp.id('org'), pg_temp.id('invoice'), 5, 'USD', 5, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now() - interval '20 days', null),
  (pg_temp.id('org'), pg_temp.id('invoice'), 7, 'USD', 7, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now(), pg_temp.id('session'));
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.run(format('select public.void_payment(%L, %L)',
  (select id from public.payments where invoice_id = pg_temp.id('invoice') and amount = 7), 'error de prueba'));
select pg_temp.assert_true(pg_temp.balance('usd') = 130, 'opening 100 + 30 (old payment and voided payment excluded)');

-- 2. Secretary records an expense in Bs (USD equivalent at the given rate) and an income in USD.
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.run(format('select public.create_account_movement(%L, %L, %L, 400, %L, %L, null, 40)',
  pg_temp.id('org'), pg_temp.id('ves'), 'expense', pg_temp.cat('Alquiler'), 'Alquiler noviembre'));
select pg_temp.run(format('select public.create_account_movement(%L, %L, %L, 20, %L)',
  pg_temp.id('org'), pg_temp.id('usd'), 'income', pg_temp.cat('Otros ingresos')));
reset role;
select pg_temp.assert_true((select amount_usd = 10 and exchange_rate = 40 from public.account_movements where account_id = pg_temp.id('ves') and kind = 'expense'),
  'Bs expense stores its USD equivalent and rate');

-- Secretary limits: no adjustments, transfers, voids or balances; wrong category kind; low rate; direct writes.
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 5, null, %L)', pg_temp.id('org'), pg_temp.id('usd'), 'adjustment_in', 'x'), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.create_account_transfer(%L, %L, 10, %L, 400)', pg_temp.id('org'), pg_temp.id('usd'), pg_temp.id('ves')), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.get_account_balances(%L)', pg_temp.id('org')), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.void_account_movement(%L, %L)', (select id from public.account_movements where org_id = pg_temp.id('org') and kind = 'expense' and account_id = pg_temp.id('ves')), 'x'), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 5, %L)', pg_temp.id('org'), pg_temp.id('usd'), 'expense', pg_temp.cat('Otros ingresos')), 'INVALID_CATEGORY');
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 400, %L, null, null, 1)', pg_temp.id('org'), pg_temp.id('ves'), 'expense', pg_temp.cat('Alquiler')), 'EXCHANGE_RATE_OUT_OF_RANGE');
select pg_temp.expect_error(format('insert into public.account_movements (org_id, account_id, kind, amount, currency, amount_usd, movement_date, created_by) values (%L, %L, %L, 1, %L, 1, current_date, %L)',
  pg_temp.id('org'), pg_temp.id('usd'), 'income', 'USD', pg_temp.id('sec')), 'row-level security');
reset role;

-- Bioanalysts have no access to finances.
select pg_temp.act_as(pg_temp.id('bio'));
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 5, %L)', pg_temp.id('org'), pg_temp.id('usd'), 'expense', pg_temp.cat('Alquiler')), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.get_finance_movements(%L)', pg_temp.id('org')), 'ERP_PERMISSION_DENIED');
reset role;

-- 3. Admin: transfer USD -> Bs with what left and what arrived; the implied rate is stored.
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.run(format('select public.create_account_transfer(%L, %L, 50, %L, 2100)', pg_temp.id('org'), pg_temp.id('usd'), pg_temp.id('ves')));
select pg_temp.assert_true(pg_temp.balance('usd') = 100, 'USD: 130 + 20 income - 50 transfer');
select pg_temp.assert_true(pg_temp.balance('ves') = 2700, 'Bs: 1000 - 400 expense + 2100 transfer');
reset role;
select pg_temp.assert_true((select exchange_rate = 42 and amount_usd = 50 from public.account_movements where org_id = pg_temp.id('org') and kind = 'transfer_in'), 'transfer stores rate 2100 / 50 = 42');

-- Transfer validations.
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect_error(format('select public.create_account_transfer(%L, %L, 10, %L)', pg_temp.id('org'), pg_temp.id('usd'), pg_temp.id('ves')), 'TRANSFER_TO_AMOUNT_REQUIRED');
select pg_temp.expect_error(format('select public.create_account_transfer(%L, %L, 10, %L, 10)', pg_temp.id('org'), pg_temp.id('usd'), pg_temp.id('usd')), 'TRANSFER_SAME_ACCOUNT');
select pg_temp.expect_error(format('select public.create_account_transfer(%L, %L, 10, %L, 10)', pg_temp.id('org'), pg_temp.id('usd'), pg_temp.id('other_usd')), 'INVALID_BANK_ACCOUNT');
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 5, %L, null, current_date - 20)', pg_temp.id('org'), pg_temp.id('usd'), 'expense', pg_temp.cat('Alquiler')), 'MOVEMENT_BEFORE_OPENING');
select pg_temp.expect_error(format('select public.create_account_movement(%L, %L, %L, 5)', pg_temp.id('org'), pg_temp.id('usd'), 'adjustment_out'), 'ADJUSTMENT_REASON_REQUIRED');

-- 4. Adjustment, then voiding a transfer voids both legs.
select pg_temp.run(format('select public.create_account_movement(%L, %L, %L, 3, null, %L)', pg_temp.id('org'), pg_temp.id('usd'), 'adjustment_out', 'Faltante en caja'));
select pg_temp.assert_true(pg_temp.balance('usd') = 97, 'adjustment out of 3');
select pg_temp.run(format('select public.void_account_movement(%L, %L)', (select id from public.account_movements where org_id = pg_temp.id('org') and kind = 'transfer_out'), 'monto errado'));
select pg_temp.assert_true(pg_temp.balance('usd') = 147 and pg_temp.balance('ves') = 600, 'voided transfer restores both accounts');
select pg_temp.expect_error(format('select public.void_account_movement(%L, %L)', (select id from public.account_movements where org_id = pg_temp.id('org') and kind = 'transfer_in'), 'otra vez'), 'MOVEMENT_ALREADY_VOID');
reset role;
select pg_temp.assert_true((select count(*) = 2 from public.account_movements where org_id = pg_temp.id('org') and transfer_id is not null and is_void), 'both legs voided');

-- 5. The ledger is immutable apart from voiding.
select pg_temp.expect_error(format('update public.account_movements set amount = 1 where org_id = %L', pg_temp.id('org')), 'ACCOUNT_MOVEMENT_IMMUTABLE');
select pg_temp.expect_error(format('delete from public.account_movements where org_id = %L', pg_temp.id('org')), 'ACCOUNT_MOVEMENT_IMMUTABLE');

-- 6. Movement listing: secretaries see income, expenses and payments (no transfers, adjustments or running balance).
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.assert_true((select count(*) = 2 from public.account_movements), 'RLS: secretary reads only income and expenses');
select pg_temp.assert_true(
  (select bool_and(r->>'kind' in ('income', 'expense', 'order_payment') and not r ? 'running_balance')
   from jsonb_array_elements(public.get_finance_movements(pg_temp.id('org'))->'rows') r),
  'secretary listing hides transfers, adjustments and balances');
reset role;
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.assert_true(
  (select (r->>'running_balance')::numeric = 147 from jsonb_array_elements(public.get_finance_movements(pg_temp.id('org'), null, null, pg_temp.id('usd'), null, 1)->'rows') r),
  'admin listing by account carries the running balance');
select pg_temp.assert_true((public.get_finance_movements(pg_temp.id('org'), null, null, null, 'transfer')->>'total')::int = 2, 'filter by transfer');
reset role;

-- 7. Cross-tenant: another lab's admin cannot see or touch this lab.
insert into ids select 'expense', id from public.account_movements where org_id = pg_temp.id('org') and kind = 'expense';
select pg_temp.act_as(pg_temp.id('other_admin'));
select pg_temp.expect_error(format('select public.get_account_balances(%L)', pg_temp.id('org')), 'ERP_PERMISSION_DENIED');
select pg_temp.expect_error(format('select public.void_account_movement(%L, %L)', pg_temp.id('expense'), 'x'), 'ERP_PERMISSION_DENIED');
select pg_temp.assert_true((select count(*) = 0 from public.account_movements), 'other lab reads no movements');
select pg_temp.expect_error(format('insert into public.finance_categories (org_id, name, kind) values (%L, %L, %L)', pg_temp.id('org'), 'Hack', 'expense'), 'row-level security');
-- Own categories are allowed.
select pg_temp.run(format('insert into public.finance_categories (org_id, name, kind) values (%L, %L, %L)', pg_temp.id('other_org'), 'Laboratorio de referencia', 'expense'));
reset role;

do $$ begin raise notice 'ERP accounts and movements passed'; end $$;
rollback;
