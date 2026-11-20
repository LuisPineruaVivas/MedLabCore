-- Test for migration 20261028106000_dashboard_staff_and_portal_lockout (audit run-2, two lows
-- plus the read-only lockout bypass lead). Rolled back.
--   npm run test:db -- audit_run2_dashboard_and_lockout
-- Prints "Audit run-2 dashboard and lockout passed".

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

-- Portal login as anon from a given client address; returns rows or the error text.
create function pg_temp.portal(p_ip text, p_dni text, p_pin text) returns text language plpgsql as $$
declare v_rows int;
begin
  perform set_config('request.headers', json_build_object('cf-connecting-ip', p_ip)::text, true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into v_rows from public.portal_authenticate(p_dni, p_pin);
  reset role;
  return 'ROWS:' || v_rows;
exception when others then
  reset role;
  return 'ERR:' || sqlerrm;
end;
$$;

create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()), ('admin', gen_random_uuid()), ('sec', gen_random_uuid()),
  ('aff', gen_random_uuid()), ('adminB', gen_random_uuid()),
  ('patA', gen_random_uuid()), ('patB', gen_random_uuid()), ('ordA', gen_random_uuid()), ('ordB', gen_random_uuid());
grant select on ids to authenticated, anon;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name) values (pg_temp.id('orgA'), 'Run2 Lock A'), (pg_temp.id('orgB'), 'Run2 Lock B');
insert into auth.users (id, email) select v, k || '@run2-lock.local' from ids where k in ('admin', 'sec', 'aff', 'adminB');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('orgA'), 'lab_admin', 'Admin', 'admin@run2-lock.local'),
  (pg_temp.id('sec'), pg_temp.id('orgA'), 'secretary', 'Sec', 'sec@run2-lock.local'),
  (pg_temp.id('aff'), pg_temp.id('orgA'), 'lab_affiliate', 'Aff', 'aff@run2-lock.local'),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@run2-lock.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
-- The same document ID registered in two labs.
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  (pg_temp.id('patA'), pg_temp.id('orgA'), 'RUN2-LOCK-77', 'Pa', 'A', '1990-01-01', 'femenino', pg_temp.id('admin')),
  (pg_temp.id('patB'), pg_temp.id('orgB'), 'RUN2-LOCK-77', 'Pb', 'B', '1990-01-01', 'femenino', pg_temp.id('adminB'));
insert into public.orders (id, org_id, patient_id, created_by, total_amount) values
  (pg_temp.id('ordA'), pg_temp.id('orgA'), pg_temp.id('patA'), pg_temp.id('admin'), 123.45),
  (pg_temp.id('ordB'), pg_temp.id('orgB'), pg_temp.id('patB'), pg_temp.id('adminB'), 1);
update public.orders set access_pin = case id when pg_temp.id('ordA') then 'RUN2LOCKAA' else 'RUN2LOCKBB' end
where id in (pg_temp.id('ordA'), pg_temp.id('ordB'));

-- Dashboard: staff yes, affiliate no -----------------------------------------
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.assert_true((public.get_dashboard_summary(pg_temp.id('orgA'))) is not null, 'secretary still reads the dashboard');
reset role;
select pg_temp.act_as(pg_temp.id('aff'));
select pg_temp.expect_error(format('select public.get_dashboard_summary(%L)', pg_temp.id('orgA')), 'PERMISSION_DENIED');
select pg_temp.expect_error(format('select * from public.get_dashboard_top_tests(%L, 5)', pg_temp.id('orgA')), 'PERMISSION_DENIED');
reset role;

-- Lockout: one client's failures do not lock the patient out elsewhere -------
do $$ begin for i in 1..10 loop perform pg_temp.portal('198.51.100.7', 'RUN2-LOCK-77', 'WRONGPIN' || i); end loop; end $$;
select pg_temp.assert_true(pg_temp.portal('198.51.100.7', 'RUN2-LOCK-77', 'RUN2LOCKAA') = 'ERR:PORTAL_LOCKED', 'the guessing client is locked');
select pg_temp.assert_true(pg_temp.portal('203.0.113.9', 'RUN2-LOCK-77', 'RUN2LOCKAA') = 'ROWS:1', 'the patient (another client) still logs in, lab A');
select pg_temp.assert_true(pg_temp.portal('203.0.113.9', 'run2-lock-77', 'RUN2LOCKBB') = 'ROWS:1', 'same ID in lab B still logs in');

-- The per-ID backstop still stops distributed guessing.
insert into public.portal_login_attempts (id_number_hash, window_start, failures)
values (encode(sha256(convert_to('RUN2-LOCK-99', 'UTF8')), 'hex'), now(), 100);
select pg_temp.assert_true(pg_temp.portal('192.0.2.1', 'RUN2-LOCK-99', 'X') = 'ERR:PORTAL_LOCKED', 'per-ID backstop at 100');

-- Read-only (GET) calls are refused before the lookup, with one generic error.
do $$
declare v_wrong text; v_right text;
begin
  begin
    perform set_config('transaction_read_only', 'on', true);
    perform * from public.portal_authenticate('RUN2-LOCK-77', 'WRONGPIN');
  exception when others then v_wrong := sqlerrm;
  end;
  begin
    perform set_config('transaction_read_only', 'on', true);
    perform * from public.portal_authenticate('RUN2-LOCK-77', 'RUN2LOCKAA');
  exception when others then v_right := sqlerrm;
  end;
  if v_wrong is distinct from 'PORTAL_UNAVAILABLE' or v_right is distinct from 'PORTAL_UNAVAILABLE' then
    raise exception 'Assertion failed: read-only calls must both give PORTAL_UNAVAILABLE (got %, %)', v_wrong, v_right;
  end if;
end $$;

do $$ begin raise notice 'Audit run-2 dashboard and lockout passed'; end $$;
rollback;
