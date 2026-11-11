-- Test for migration 20261108030000_erp_finance_dashboard (ERP finances, phase 4).
-- Rolled back. Prints "ERP finance dashboard passed".
--   npm run test:db -- erp_finance_dashboard

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
  ('org', gen_random_uuid()), ('admin', gen_random_uuid()), ('sec', gen_random_uuid()), ('patient', gen_random_uuid()),
  ('order', gen_random_uuid()), ('invoice', gen_random_uuid()), ('usd', gen_random_uuid()), ('ves', gen_random_uuid());
grant select, insert on ids to authenticated;
create temp table dash (d jsonb);
grant select, insert on dash to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.run(p_sql text) returns void language plpgsql as $$ begin execute p_sql; end $$;
create function pg_temp.cat(p_name text) returns uuid language sql as $$
  select id from public.finance_categories where org_id is null and name = p_name
$$;
grant execute on function pg_temp.cat(text) to authenticated;

insert into public.organizations (id, name, has_erp_module) values (pg_temp.id('org'), 'Dashboard Lab', true);
insert into auth.users (id, email) select v, k || '@dashboard.local' from ids where k in ('admin', 'sec');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@dashboard.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@dashboard.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'DASH-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by) values (pg_temp.id('order'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'));
insert into public.invoices (id, org_id, invoice_number, invoice_seq, order_id, patient_id, created_by, subtotal_usd, total_usd, balance_due_usd, amount_paid_usd, status)
values (pg_temp.id('invoice'), pg_temp.id('org'), 'DASH-1', 1, pg_temp.id('order'), pg_temp.id('patient'), pg_temp.id('admin'), 1000, 1000, 1000, 0, 'issued');
insert into public.bank_accounts (id, org_id, name, method_type, currency, opening_balance, opening_date) values
  (pg_temp.id('usd'), pg_temp.id('org'), 'Caja USD', 'cash', 'USD', 0, current_date - 90),
  (pg_temp.id('ves'), pg_temp.id('org'), 'Banco Bs', 'bank_transfer', 'VES', 0, current_date - 90);

-- Order payments: 100 today, 40 two months ago, 30 today but voided.
insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, bank_account_id, payment_method, created_by, payment_date, is_void, void_reason) values
  (pg_temp.id('org'), pg_temp.id('invoice'), 100, 'USD', 100, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now(), false, null),
  (pg_temp.id('org'), pg_temp.id('invoice'), 40, 'USD', 40, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now() - interval '2 months', false, null),
  (pg_temp.id('org'), pg_temp.id('invoice'), 30, 'USD', 30, pg_temp.id('usd'), 'Caja USD', pg_temp.id('admin'), now(), true, 'error');

-- Movements today: other income 20; expenses 50 (rent) and 400 Bs at 40 = 10 (services); a voided expense,
-- a transfer and an adjustment, none of which count.
select pg_temp.act_as(pg_temp.id('admin'));
select public.create_account_movement(pg_temp.id('org'), pg_temp.id('usd'), 'income', 20, pg_temp.cat('Otros ingresos'));
select public.create_account_movement(pg_temp.id('org'), pg_temp.id('usd'), 'expense', 50, pg_temp.cat('Alquiler'));
select public.create_account_movement(pg_temp.id('org'), pg_temp.id('ves'), 'expense', 400, pg_temp.cat('Servicios (luz, agua, internet, teléfono)'), null, null, 40);
insert into ids select 'voided', (public.create_account_movement(pg_temp.id('org'), pg_temp.id('usd'), 'expense', 999, pg_temp.cat('Alquiler'))->>'movement_id')::uuid;
select pg_temp.run(format('select public.void_account_movement(%L, %L)', pg_temp.id('voided'), 'duplicado'));
select public.create_account_transfer(pg_temp.id('org'), pg_temp.id('usd'), 10, pg_temp.id('ves'), 400);
select public.create_account_movement(pg_temp.id('org'), pg_temp.id('usd'), 'adjustment_out', 5, null, 'faltante');

insert into dash select public.get_finance_dashboard(pg_temp.id('org'));
reset role;

select pg_temp.assert_true((select (d->>'order_income_usd')::numeric = 100 and (d->>'other_income_usd')::numeric = 20 and (d->>'income_usd')::numeric = 120 from dash), 'income this month: 100 orders + 20 other');
select pg_temp.assert_true((select (d->>'expenses_usd')::numeric = 60 and (d->>'profit_usd')::numeric = 60 from dash), 'expenses 50 + 10, profit 60');
select pg_temp.assert_true((select d->'expenses_by_category'->0->>'category' = 'Alquiler' and (d->'expenses_by_category'->0->>'amount_usd')::numeric = 50
  and jsonb_array_length(d->'expenses_by_category') = 2 from dash), 'expenses by category, largest first');
select pg_temp.assert_true((select jsonb_array_length(d->'monthly') = 6 from dash), 'six months of history');
select pg_temp.assert_true((select (d->'monthly'->5->>'income_usd')::numeric = 120 and (d->'monthly'->5->>'expenses_usd')::numeric = 60
  and (d->'monthly'->3->>'income_usd')::numeric = 40 from dash), 'current month and the payment of two months ago');

select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format('select public.get_finance_dashboard(%L)', pg_temp.id('org')), 'ERP_PERMISSION_DENIED');
reset role;

do $$ begin raise notice 'ERP finance dashboard passed'; end $$;
rollback;
