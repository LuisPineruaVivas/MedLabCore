-- Test for migration 20261028104000_register_payment_rate_floor (audit run-2, medium).
-- Rolled back. Prints "Audit run-2 register_payment passed".
--   npm run test:db -- audit_run2_register_payment

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
  ('org', gen_random_uuid()), ('admin', gen_random_uuid()), ('sec', gen_random_uuid()),
  ('patient', gen_random_uuid()), ('order', gen_random_uuid()), ('invoice', gen_random_uuid()), ('ves', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.run(p_sql text) returns void language plpgsql as $$ begin execute p_sql; end $$;
create function pg_temp.pay(p_amount numeric, p_rate numeric) returns text language sql as $$
  select format('select public.register_payment(%L, %L, %L::jsonb)', pg_temp.id('org'), pg_temp.id('invoice'),
    jsonb_build_array(jsonb_build_object('bank_account_id', pg_temp.id('ves'), 'currency', 'VES', 'amount', p_amount, 'exchange_rate', p_rate)))
$$;

insert into public.organizations (id, name, has_erp_module) values (pg_temp.id('org'), 'Run2 Rate Lab', true);
insert into auth.users (id, email) select v, k || '@run2-rate.local' from ids where k in ('admin', 'sec');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@run2-rate.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@run2-rate.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'RUN2-RATE-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by) values (pg_temp.id('order'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'));
insert into public.invoices (id, org_id, invoice_number, invoice_seq, order_id, patient_id, created_by, subtotal_usd, total_usd, balance_due_usd, amount_paid_usd, status)
values (pg_temp.id('invoice'), pg_temp.id('org'), 'RUN2-1', 1, pg_temp.id('order'), pg_temp.id('patient'), pg_temp.id('admin'), 100, 100, 100, 0, 'issued');
insert into public.bank_accounts (id, org_id, name, method_type, currency) values (pg_temp.id('ves'), pg_temp.id('org'), 'Pago movil', 'mobile_payment', 'VES');
insert into public.exchange_rate_history (org_id, from_currency, to_currency, rate, effective_date) values (pg_temp.id('org'), 'USD', 'VES', 40, current_date);

-- 1. The run-1 attack: 1 VES at a rate of 0.01 is refused for a secretary.
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(pg_temp.pay(1, 0.01), 'EXCHANGE_RATE_OUT_OF_RANGE');
-- Just over 10% below the lab's rate is refused too; within 10% is accepted.
select pg_temp.expect_error(pg_temp.pay(35, 35), 'EXCHANGE_RATE_OUT_OF_RANGE');
select pg_temp.run(pg_temp.pay(370, 37));
-- A higher (newer) live rate is fine.
select pg_temp.run(pg_temp.pay(410, 41));
reset role;
select pg_temp.assert_true(
  (select sum(amount_usd) from public.payments where invoice_id = pg_temp.id('invoice')) = 20,
  'two legitimate payments credited 10 + 10 USD');
select pg_temp.assert_true(
  (select bool_and(exchange_rate_id is null) from public.payments where invoice_id = pg_temp.id('invoice')),
  'client rates are not linked to the stored rate record');

-- 2. Paying at the stored rate links that record.
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.run(pg_temp.pay(400, 40));
reset role;
select pg_temp.assert_true(
  (select exchange_rate_id is not null from public.payments where invoice_id = pg_temp.id('invoice') and exchange_rate = 40),
  'stored rate linked when it is the one applied');

-- 3. A lab_admin may still use a different rate (manual correction).
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.run(pg_temp.pay(2, 1));
reset role;
select pg_temp.assert_true(
  (select count(*) from public.payments where invoice_id = pg_temp.id('invoice') and exchange_rate = 1) = 1,
  'lab_admin override accepted');

do $$ begin raise notice 'Audit run-2 register_payment passed'; end $$;
rollback;
