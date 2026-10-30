-- Test for migration 20261028103000_create_lab_order_server_prices (audit run-2, two mediums).
-- Rolled back. Prints "Audit run-2 create_lab_order passed".
--   npm run test:db -- audit_run2_create_lab_order

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
  ('org', gen_random_uuid()), ('other', gen_random_uuid()),
  ('admin', gen_random_uuid()), ('sec', gen_random_uuid()), ('aff', gen_random_uuid()), ('otherAdmin', gen_random_uuid()),
  ('labPatient', gen_random_uuid()), ('affPatient', gen_random_uuid()),
  ('tpl10', gen_random_uuid()), ('global20', gen_random_uuid()), ('fork25', gen_random_uuid()),
  ('otherTpl', gen_random_uuid()), ('profile', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.line(p_key text, p_price numeric, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('test_name', p_key, 'price', p_price, 'template_id', pg_temp.id(p_key),
                            'schema', '{"sections":[],"value":"PREFILLED_BY_CALLER"}'::jsonb) || p_extra
$$;
create function pg_temp.order_total(p_result jsonb) returns numeric language sql as $$
  select total_amount from public.orders where id = (p_result->>'orderId')::uuid
$$;

insert into public.organizations (id, name) values (pg_temp.id('org'), 'Run2 Price Lab'), (pg_temp.id('other'), 'Run2 Other Lab');
insert into auth.users (id, email) select v, k || '@run2-price.local' from ids where k in ('admin', 'sec', 'aff', 'otherAdmin');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@run2-price.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@run2-price.local'),
  (pg_temp.id('aff'), pg_temp.id('org'), 'lab_affiliate', 'Aff', 'aff@run2-price.local'),
  (pg_temp.id('otherAdmin'), pg_temp.id('other'), 'lab_admin', 'Other', 'other@run2-price.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  (pg_temp.id('labPatient'), pg_temp.id('org'), 'RUN2-PR-1', 'Lab', 'Patient', '1990-01-01', 'femenino', pg_temp.id('admin')),
  (pg_temp.id('affPatient'), pg_temp.id('org'), 'RUN2-PR-2', 'Aff', 'Patient', '1990-01-01', 'femenino', pg_temp.id('aff'));
insert into public.test_templates (id, org_id, name, category, base_price, schema, id_global_ref) values
  (pg_temp.id('tpl10'), pg_temp.id('org'), 'Run2 T10', 'General', 10, '{"sections":[{"name":"S"}]}', null),
  (pg_temp.id('global20'), null, 'Run2 Global', 'General', 20, '{"sections":[]}', null),
  (pg_temp.id('fork25'), pg_temp.id('org'), 'Run2 Global', 'General', 25, '{"sections":[]}', pg_temp.id('global20')),
  (pg_temp.id('otherTpl'), pg_temp.id('other'), 'Run2 Other', 'General', 1, '{"sections":[]}', null);
insert into public.exam_profiles (id, org_id, name, total_price) values (pg_temp.id('profile'), pg_temp.id('org'), 'Run2 Profile', 30);

-- 1. An affiliate cannot order for a patient it did not register; its own patient works.
select pg_temp.act_as(pg_temp.id('aff'));
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, null, null, false, %L::jsonb, %L)',
  pg_temp.id('org'), pg_temp.id('labPatient'), jsonb_build_array(pg_temp.line('tpl10', 10)), pg_temp.id('aff')), 'INVALID_PATIENT');

-- 2. An affiliate's price 0 for a 10-priced test is ignored, and its pre-filled results too.
create temp table r_aff as select public.create_lab_order(pg_temp.id('org'), pg_temp.id('affPatient'), null, null, null, false,
  jsonb_build_array(pg_temp.line('tpl10', 0)), pg_temp.id('aff')) as r;
reset role;
select pg_temp.assert_true(pg_temp.order_total((select r from r_aff)) = 10, 'affiliate order priced from the template');
select pg_temp.assert_true(
  (select results_data from public.order_items where order_id = ((select r from r_aff)->>'orderId')::uuid) = '{"sections":[{"name":"S"}]}'::jsonb,
  'results_data comes from the template schema, not the caller');

-- 3. A secretary cannot underprice; the lab's copy of a global template wins.
select pg_temp.act_as(pg_temp.id('sec'));
create temp table r_sec as select public.create_lab_order(pg_temp.id('org'), pg_temp.id('labPatient'), null, 40, 1, false,
  jsonb_build_array(pg_temp.line('tpl10', 1), pg_temp.line('global20', 0)), pg_temp.id('sec')) as r;
reset role;
select pg_temp.assert_true(pg_temp.order_total((select r from r_sec)) = 35, 'secretary prices replaced: 10 + fork 25');
select pg_temp.assert_true(
  (select total_bs from public.orders where id = ((select r from r_sec)->>'orderId')::uuid) = 1400,
  'total_bs recomputed from the server total (35 x 40), not the caller');

-- 4. Profiles: the header uses exam_profiles.total_price, children stay at 0.
select pg_temp.act_as(pg_temp.id('sec'));
create temp table r_prof as select public.create_lab_order(pg_temp.id('org'), pg_temp.id('labPatient'), null, null, null, false,
  jsonb_build_array(
    jsonb_build_object('test_name', 'Run2 Profile', 'price', 1, 'isProfileHeader', true, 'profileId', pg_temp.id('profile')),
    pg_temp.line('tpl10', 9, jsonb_build_object('parentProfileId', pg_temp.id('profile')))), pg_temp.id('sec')) as r;
reset role;
select pg_temp.assert_true(pg_temp.order_total((select r from r_prof)) = 30, 'profile priced from exam_profiles');

-- 5. Another lab's template, or a free line from a non-admin, is refused.
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, null, null, false, %L::jsonb, %L)',
  pg_temp.id('org'), pg_temp.id('labPatient'), jsonb_build_array(pg_temp.line('otherTpl', 1)), pg_temp.id('sec')), 'INVALID_TEMPLATE');
select pg_temp.expect_error(format('select public.create_lab_order(%L, %L, null, null, null, false, %L::jsonb, %L)',
  pg_temp.id('org'), pg_temp.id('labPatient'), '[{"test_name":"Libre","price":1}]', pg_temp.id('sec')), 'INVALID_TEMPLATE');
reset role;

-- 6. A lab_admin may still set a price (same rule as editing an item price).
select pg_temp.act_as(pg_temp.id('admin'));
create temp table r_admin as select public.create_lab_order(pg_temp.id('org'), pg_temp.id('labPatient'), null, null, null, false,
  jsonb_build_array(pg_temp.line('tpl10', 8), jsonb_build_object('test_name', 'Libre', 'price', 2)), pg_temp.id('admin')) as r;
reset role;
select pg_temp.assert_true(pg_temp.order_total((select r from r_admin)) = 10, 'lab_admin override (8) plus free line (2)');

do $$ begin raise notice 'Audit run-2 create_lab_order passed'; end $$;
rollback;
