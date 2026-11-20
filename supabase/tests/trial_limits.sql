-- Test for migration 20261115000000_trial_limits. Rolled back.
--   npm run test:db -- trial_limits
-- A trial lab stops at 10 patients and 20 orders, a lab created by the super admin has no limit,
-- an approved subscription payment lifts the limit, and the signup trigger marks new labs as trials.
-- Prints "Trial limits passed".

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

create temp table ids (k text primary key, v uuid);
insert into ids values ('trial', gen_random_uuid()), ('paid', gen_random_uuid()), ('admin', gen_random_uuid());
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

-- Adds n patients (and one order per patient) to a lab, numbering them from p_from.
create function pg_temp.add_patients(p_org uuid, p_from int, p_n int) returns void language sql as $$
  insert into public.patients (org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
  select p_org, 'TRIAL-' || p_org || '-' || g, 'P', 'T', '1990-01-01', 'femenino', pg_temp.id('admin')
  from generate_series(p_from, p_from + p_n - 1) g
$$;
create function pg_temp.add_orders(p_org uuid, p_n int) returns void language sql as $$
  insert into public.orders (org_id, patient_id, created_by, total_amount)
  select p_org, (select id from public.patients where org_id = p_org limit 1), pg_temp.id('admin'), 1
  from generate_series(1, p_n)
$$;

insert into public.organizations (id, name, is_trial) values (pg_temp.id('trial'), 'Trial Limits Lab', true);
insert into public.organizations (id, name) values (pg_temp.id('paid'), 'Trial Limits Paid Lab');
insert into auth.users (id, email) values (pg_temp.id('admin'), 'admin@trial-limits.local');

-- Trial lab: 10 patients fit, the 11th is refused with a clear message.
select pg_temp.add_patients(pg_temp.id('trial'), 1, 10);
select pg_temp.expect_error(format('select pg_temp.add_patients(%L, 11, 1)', pg_temp.id('trial')), 'hasta 10 pacientes');

-- Trial lab: 20 orders fit, the 21st is refused.
select pg_temp.add_orders(pg_temp.id('trial'), 20);
select pg_temp.expect_error(format('select pg_temp.add_orders(%L, 1)', pg_temp.id('trial')), 'hasta 20 órdenes');

-- A lab created by the super admin has no limit.
select pg_temp.add_patients(pg_temp.id('paid'), 1, 12);
select pg_temp.add_orders(pg_temp.id('paid'), 22);
select pg_temp.assert_true((select count(*) = 22 from public.orders where org_id = pg_temp.id('paid')), 'non-trial lab is not limited');

-- Once a subscription payment is approved, the trial lab is no longer limited.
insert into public.subscription_payments (org_id, payment_method, reference_number, proof_url, status)
values (pg_temp.id('trial'), 'pago_movil', 'REF-1', 'x', 'approved');
select pg_temp.add_patients(pg_temp.id('trial'), 11, 1);
select pg_temp.add_orders(pg_temp.id('trial'), 1);

-- A self-service signup gets a trial lab.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
  'trial-limits@test.dev', 'x', '{"provider":"email"}', '{"lab_name":"Lab Limite Trial","signup":"trial"}', now(), now(), now());
select pg_temp.assert_true(
  (select o.is_trial from public.profiles p join public.organizations o on o.id = p.org_id
   where p.id = '33333333-3333-4333-8333-333333333333'),
  'signup creates a trial lab');

do $$ begin raise notice 'Trial limits passed'; end $$;
rollback;
