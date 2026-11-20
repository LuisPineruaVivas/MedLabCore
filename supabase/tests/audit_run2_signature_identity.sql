-- Test for migration 20261028105000_signature_identity_binding (audit run-2, medium).
-- Rolled back. Prints "Audit run-2 signature identity passed".
--   npm run test:db -- audit_run2_signature_identity

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
  ('org', gen_random_uuid()), ('admin', gen_random_uuid()), ('bioA', gen_random_uuid()), ('bioB', gen_random_uuid()),
  ('patient', gen_random_uuid()), ('order', gen_random_uuid()), ('order2', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.url(p_user text, p_file text) returns text language sql as $$
  select 'http://127.0.0.1:54321/storage/v1/object/public/firms_stamps/' || pg_temp.id(p_user) || '/' || p_file
$$;

insert into public.organizations (id, name) values (pg_temp.id('org'), 'Run2 Sign Lab');
insert into auth.users (id, email) select v, k || '@run2-sign.local' from ids where k in ('admin', 'bioA', 'bioB');
insert into public.profiles (id, org_id, role, full_name, email, firma_url, sello_url, signature_footer_text) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@run2-sign.local', null, null, null),
  (pg_temp.id('bioA'), pg_temp.id('org'), 'bioanalyst', 'Bio A', 'bioA@run2-sign.local', pg_temp.url('bioA', 'firma-1.png'), null, 'Lic. A'),
  (pg_temp.id('bioB'), pg_temp.id('org'), 'bioanalyst', 'Bio B', 'bioB@run2-sign.local', pg_temp.url('bioB', 'firma-1.png'), pg_temp.url('bioB', 'sello-1.png'), 'Lic. B')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
  firma_url = excluded.firma_url, sello_url = excluded.sello_url, signature_footer_text = excluded.signature_footer_text;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'RUN2-SIG-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by, status) values
  (pg_temp.id('order'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'), 'por_aprobar'),
  (pg_temp.id('order2'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'), 'pendiente');

-- 1. Bio A cannot borrow Bio B's signature, stamp or name (the run-2 reproduction).
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('update public.profiles set firma_url = %L where id = %L', pg_temp.url('bioB', 'firma-1.png'), pg_temp.id('bioA')),
  'SIGNATURE_URL_NOT_OWNED');
select pg_temp.expect_error(format('update public.profiles set sello_url = %L where id = %L', 'https://example.com/sello.png', pg_temp.id('bioA')),
  'SIGNATURE_URL_NOT_OWNED');
select pg_temp.expect_error(format('update public.profiles set full_name = %L where id = %L', 'Bio B', pg_temp.id('bioA')),
  'PROFILE_NAME_ADMIN_ONLY');

-- 2. The normal profile settings flow still works: own uploads, removal, footer text.
update public.profiles set firma_url = pg_temp.url('bioA', 'firma-2.png'), sello_url = pg_temp.url('bioA', 'sello-2.png'),
  signature_footer_text = 'Lic. A, MPPS 123' where id = pg_temp.id('bioA');
update public.profiles set sello_url = null where id = pg_temp.id('bioA');

-- 3. Signing records the real signer; it is not client-writable.
update public.orders set status = 'completada', completed_at = now() where id = pg_temp.id('order');
update public.orders set signed_by = pg_temp.id('bioB') where id = pg_temp.id('order2');
reset role;
select pg_temp.assert_true((select signed_by = pg_temp.id('bioA') and firma_url = pg_temp.url('bioA', 'firma-2.png')
  from public.orders where id = pg_temp.id('order')), 'completed order records Bio A as signer with Bio A''s signature');
select pg_temp.assert_true((select signed_by is null from public.orders where id = pg_temp.id('order2')), 'signed_by cannot be set by a client');

do $$ begin raise notice 'Audit run-2 signature identity passed'; end $$;
rollback;
