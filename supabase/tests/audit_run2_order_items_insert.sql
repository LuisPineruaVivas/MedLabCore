-- Test for migration 20261028100000_order_items_insert_guard (audit run-2, high).
-- Rolled back. Prints "Audit run-2 order_items insert passed".
--   npm run test:db -- audit_run2_order_items_insert

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
  ('bio', gen_random_uuid()), ('aff', gen_random_uuid()), ('patient', gen_random_uuid()),
  ('labOrder', gen_random_uuid()), ('affOrder', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name) values (pg_temp.id('org'), 'Run2 Items Lab');
insert into auth.users (id, email) select v, k || '@run2-items.local' from ids where k in ('admin', 'sec', 'bio', 'aff');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@run2-items.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@run2-items.local'),
  (pg_temp.id('bio'), pg_temp.id('org'), 'bioanalyst', 'Bio', 'bio@run2-items.local'),
  (pg_temp.id('aff'), pg_temp.id('org'), 'lab_affiliate', 'Aff', 'aff@run2-items.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'RUN2-ITEMS-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by, status) values
  (pg_temp.id('labOrder'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin'), 'completada'),
  (pg_temp.id('affOrder'), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('aff'), 'completada');

-- 1. Secretary and bioanalyst can no longer add items to a completed order
--    (the BEFORE INSERT guard fires before the RLS check, so either error is a denial).
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format(
  $q$insert into public.order_items (order_id, test_name, price_at_order, results_data) values (%L, 'FORGED', 999, '{"value":"X"}')$q$,
  pg_temp.id('labOrder')), 'row-level security|ORDER_RESULTS_LOCKED');
reset role;
select pg_temp.act_as(pg_temp.id('bio'));
select pg_temp.expect_error(format(
  $q$insert into public.order_items (order_id, test_name, price_at_order, results_data) values (%L, 'FORGED', 1, '{"value":"X"}')$q$,
  pg_temp.id('labOrder')), 'row-level security|ORDER_RESULTS_LOCKED');
reset role;

-- 2. An affiliate can no longer add result rows, even to its own order.
select pg_temp.act_as(pg_temp.id('aff'));
select pg_temp.expect_error(format(
  $q$insert into public.order_items (order_id, test_name, price_at_order, results_data) values (%L, 'AFF', 0, '{"value":"X"}')$q$,
  pg_temp.id('affOrder')), 'row-level security|ORDER_RESULTS_LOCKED');
reset role;

-- 3. The guard itself (defense in depth): even with an insert policy, the rules hold.
create policy "run2 test insert" on public.order_items for insert to authenticated with check (true);
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect_error(format(
  $q$insert into public.order_items (order_id, test_name, price_at_order) values (%L, 'X', 1)$q$,
  pg_temp.id('labOrder')), 'ORDER_RESULTS_LOCKED');
reset role;
update public.orders set status = 'pendiente' where id = pg_temp.id('labOrder');
select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.expect_error(format(
  $q$insert into public.order_items (order_id, test_name, price_at_order) values (%L, 'X', 1)$q$,
  pg_temp.id('labOrder')), 'ORDER_PAYMENT_FORBIDDEN');
reset role;
drop policy "run2 test insert" on public.order_items;

-- 4. Orders created through create_lab_order still get their items.
insert into ids values ('tpl', gen_random_uuid());
insert into public.test_templates (id, org_id, name, category, base_price) values (pg_temp.id('tpl'), pg_temp.id('org'), 'Run2 Test', 'General', 5);
select pg_temp.act_as(pg_temp.id('sec'));
create temp table created as
select public.create_lab_order(pg_temp.id('org'), pg_temp.id('patient'), null, null, null, false,
  jsonb_build_array(jsonb_build_object('test_name', 'Run2 Test', 'price', 5, 'template_id', pg_temp.id('tpl'))), pg_temp.id('sec')) as r;
reset role;
select pg_temp.assert_true(
  (select count(*) from public.order_items where order_id = ((select r from created)->>'orderId')::uuid) = 1,
  'create_lab_order still inserts its items');

do $$ begin raise notice 'Audit run-2 order_items insert passed'; end $$;
rollback;
