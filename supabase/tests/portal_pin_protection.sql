-- Test for migration 20261025020000_portal_pin_protection (improvement plan S-03).
-- Wrong portal PINs are limited per document ID; new orders get 10-character PINs.
-- Runs inside a transaction and rolls back, so it leaves no data behind:
--   npm run test:db -- portal_pin
-- Prints "Portal PIN protection passed".

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

create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'Assertion failed: %', p_label; end if;
end;
$$;

-- Logins run as the anonymous portal role, exactly like a patient's browser.
create function pg_temp.login(p_dni text, p_pin text) returns integer language plpgsql as $$
declare v_rows integer;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into v_rows from public.portal_authenticate(p_dni, p_pin);
  reset role;
  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (written as postgres): two patients with one order each and known PINs.
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values ('org', gen_random_uuid()), ('staff', gen_random_uuid()), ('patientA', gen_random_uuid()), ('patientB', gen_random_uuid());
grant select on ids to anon;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, is_active, subscription_active, email)
values (pg_temp.id('org'), 'PIN Test Lab', true, true, 'pin@pin-test.local');
insert into auth.users (id, email) values (pg_temp.id('staff'), 'staff@pin-test.local');
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  (pg_temp.id('patientA'), pg_temp.id('org'), 'PINTEST-A', 'Paciente', 'A', '1990-01-01', 'femenino', pg_temp.id('staff')),
  (pg_temp.id('patientB'), pg_temp.id('org'), 'PINTEST-B', 'Paciente', 'B', '1990-01-01', 'masculino', pg_temp.id('staff'));
insert into public.orders (org_id, patient_id, total_amount, created_by) values
  (pg_temp.id('org'), pg_temp.id('patientA'), 0, pg_temp.id('staff')), (pg_temp.id('org'), pg_temp.id('patientB'), 0, pg_temp.id('staff'));
-- Known PINs in the old 8-character format, to show existing PINs keep working.
update public.orders set access_pin = 'A1B2C3D4' where patient_id = pg_temp.id('patientA');
update public.orders set access_pin = 'E5F6A7B8' where patient_id = pg_temp.id('patientB');

-- ---------------------------------------------------------------------------
-- The counter table is not reachable from the API.
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(not has_table_privilege('anon', 'public.portal_login_attempts', 'select'), 'anon cannot read attempts');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.portal_login_attempts', 'select'), 'authenticated cannot read attempts');

-- ---------------------------------------------------------------------------
-- Old 8-character PINs still log in; ID and PIN are case/space-insensitive as before.
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(pg_temp.login('PINTEST-A', 'A1B2C3D4') = 1, 'old PIN logs in');
select pg_temp.assert_true(pg_temp.login(' pintest-a ', ' a1b2c3d4 ') = 1, 'case and spaces ignored');

-- ---------------------------------------------------------------------------
-- 9 wrong PINs then the right one: allowed, and the counter is cleared.
-- ---------------------------------------------------------------------------
do $$ begin for i in 1..9 loop perform pg_temp.login('PINTEST-A', 'WRONG' || i); end loop; end $$;
select pg_temp.assert_true(pg_temp.login('PINTEST-A', 'A1B2C3D4') = 1, 'right PIN after 9 failures');
select pg_temp.assert_true(not exists (select 1 from public.portal_login_attempts), 'success clears the counter');

-- ---------------------------------------------------------------------------
-- 10 wrong PINs: that ID is locked, even with the right PIN; the other patient is not.
-- ---------------------------------------------------------------------------
do $$ begin for i in 1..10 loop perform pg_temp.login('PINTEST-A', 'WRONG' || i); end loop; end $$;
select pg_temp.expect_error($$select pg_temp.login('PINTEST-A', 'A1B2C3D4')$$, 'PORTAL_LOCKED');
select pg_temp.expect_error($$select pg_temp.login('pintest-a', 'anything')$$, 'PORTAL_LOCKED');
select pg_temp.assert_true(pg_temp.login('PINTEST-B', 'E5F6A7B8') = 1, 'other patient unaffected');
-- The ID number itself is never stored, only its hash.
select pg_temp.assert_true(not exists (select 1 from public.portal_login_attempts where id_number_hash ilike '%PINTEST%'), 'ID stored hashed');

-- ---------------------------------------------------------------------------
-- After the hour passes, the right PIN works again.
-- ---------------------------------------------------------------------------
update public.portal_login_attempts set window_start = now() - interval '61 minutes';
select pg_temp.assert_true(pg_temp.login('PINTEST-A', 'A1B2C3D4') = 1, 'unlocked after an hour');

-- A failure after an expired window starts a new window at 1.
update public.portal_login_attempts set window_start = now() - interval '2 hours', failures = 10;
insert into public.portal_login_attempts (id_number_hash, window_start, failures)
select encode(sha256(convert_to('PINTEST-B', 'UTF8')), 'hex'), now() - interval '2 hours', 10;
select pg_temp.assert_true(pg_temp.login('PINTEST-B', 'WRONG') = 0, 'wrong PIN after expired window');
select pg_temp.assert_true((select failures = 1 and window_start > now() - interval '1 minute' from public.portal_login_attempts
  where id_number_hash = encode(sha256(convert_to('PINTEST-B', 'UTF8')), 'hex')), 'new window starts at 1');

-- ---------------------------------------------------------------------------
-- New orders get 10-character PINs from the unambiguous alphabet, all different.
-- ---------------------------------------------------------------------------
insert into public.orders (org_id, patient_id, total_amount, created_by)
select pg_temp.id('org'), pg_temp.id('patientA'), 0, pg_temp.id('staff') from generate_series(1, 300);
select pg_temp.assert_true((select bool_and(access_pin ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$') from public.orders
  where patient_id = pg_temp.id('patientA') and access_pin <> 'A1B2C3D4'), 'new PIN format');
select pg_temp.assert_true((select count(distinct access_pin) = 300 from public.orders
  where patient_id = pg_temp.id('patientA') and access_pin <> 'A1B2C3D4'), 'new PINs are distinct');
-- A new PIN logs in like an old one.
select pg_temp.assert_true(pg_temp.login('PINTEST-A', (select access_pin from public.orders
  where patient_id = pg_temp.id('patientA') and access_pin <> 'A1B2C3D4' limit 1)) = 1, 'new PIN logs in');

do $$ begin raise notice 'Portal PIN protection passed'; end $$;

rollback;
