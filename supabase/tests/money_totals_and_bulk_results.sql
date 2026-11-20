-- Test for migration 20261025010000_money_totals_and_bulk_results (improvement plan Phase 2).
-- Billing and affiliate totals must cover more than 1,000 orders and only the caller's
-- lab; "Guardar todo" must save all items or none and keep the completed-order lock.
-- Runs inside a transaction and rolls back, so it leaves no data behind:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/money_totals_and_bulk_results.sql
-- (prepend the migration if it is not applied yet). Prints "Money totals and bulk results passed".

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

create function pg_temp.assert_eq(p_actual numeric, p_expected numeric, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Assertion failed (%): expected %, got %', p_label, p_expected, p_actual;
  end if;
end;
$$;

create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'Assertion failed: %', p_label; end if;
end;
$$;

-- Calls run as the PostgREST role, exactly like a browser request.
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Static checks: not callable by anon, and not SECURITY DEFINER (RLS must apply).
-- ---------------------------------------------------------------------------
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.get_billing_totals(uuid,timestamptz,timestamptz,timestamptz)',
    'public.get_affiliate_pending_balance(uuid)',
    'public.save_order_results(uuid,jsonb)'
  ] loop
    if has_function_privilege('anon', v_fn, 'execute') then raise exception 'anon can execute %', v_fn; end if;
    if not has_function_privilege('authenticated', v_fn, 'execute') then raise exception 'authenticated cannot execute %', v_fn; end if;
    if (select prosecdef from pg_proc where oid = v_fn::regprocedure) then raise exception '% is SECURITY DEFINER', v_fn; end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (written as postgres).
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('bioA', gen_random_uuid()), ('affA', gen_random_uuid()),
  ('adminB', gen_random_uuid()), ('bioB', gen_random_uuid()),
  ('patientA', gen_random_uuid()),
  ('orderOpen', gen_random_uuid()), ('orderDone', gen_random_uuid()), ('orderOther', gen_random_uuid()),
  ('item1', gen_random_uuid()), ('item2', gen_random_uuid()), ('item3', gen_random_uuid()),
  ('itemDone', gen_random_uuid()), ('itemOther', gen_random_uuid());
grant select on ids to authenticated;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, has_erp_module, subscription_active, is_active, rif, email) values
  (pg_temp.id('orgA'), 'Money Test A', false, true, true, 'J-MONEY-A', 'a@money-test.local'),
  (pg_temp.id('orgB'), 'Money Test B', false, true, true, 'J-MONEY-B', 'b@money-test.local');

insert into auth.users (id, email)
select v, k || '@money-test.local' from ids where k in ('adminA', 'bioA', 'affA', 'adminB', 'bioB');

insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@money-test.local'),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@money-test.local'),
  (pg_temp.id('affA'), pg_temp.id('orgA'), 'lab_affiliate', 'Afiliado A', 'affA@money-test.local'),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@money-test.local'),
  (pg_temp.id('bioB'), pg_temp.id('orgB'), 'bioanalyst', 'Bio B', 'bioB@money-test.local')
-- The auth.users trigger (handle_new_user) may already have created the profile.
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name, email = excluded.email;

delete from public.user_roles where user_id in (select v from ids);
-- Lab roles come from profiles.role (S-09); user_roles holds super admins only.

insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by) values
  (pg_temp.id('patientA'), pg_temp.id('orgA'), 'MONEY-A-1', 'Paciente', 'A', '1990-01-01', 'femenino', pg_temp.id('adminA'));

-- January 2026: 1,200 orders of 2.50 (300 of them 'pendiente')   -> 3,000.00
-- February 2026: 5 orders of 10.00                                -> 50.00
-- June 2025: 1,100 affiliate orders of 1.00, payment 'pending'   -> 1,100.00
insert into public.orders (org_id, patient_id, created_by, total_amount, status, payment_status, created_at)
select pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 2.50,
       (case when g <= 300 then 'pendiente' else 'procesando' end)::public.order_status, 'paid',
       timestamptz '2026-01-01 12:00-04' + (g % 28) * interval '1 day'
from generate_series(1, 1200) g;

insert into public.orders (org_id, patient_id, created_by, total_amount, status, payment_status, created_at)
select pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 10, 'procesando', 'paid', timestamptz '2026-02-10 12:00-04'
from generate_series(1, 5);

insert into public.orders (org_id, patient_id, created_by, total_amount, status, payment_status, created_at)
select pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('affA'), 1, 'procesando', 'pending', timestamptz '2025-06-01 12:00-04'
from generate_series(1, 1100);

-- Orders for the result saves (amount 0 so they don't change the totals above).
insert into public.orders (id, org_id, patient_id, created_by, total_amount, status, created_at) values
  (pg_temp.id('orderOpen'), pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 0, 'procesando', '2024-01-01'),
  (pg_temp.id('orderDone'), pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 0, 'completada', '2024-01-01'),
  (pg_temp.id('orderOther'), pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 0, 'procesando', '2024-01-01');

insert into public.order_items (id, order_id, test_name, results_data) values
  (pg_temp.id('item1'), pg_temp.id('orderOpen'), 'Glucosa', '{"v":"old"}'),
  (pg_temp.id('item2'), pg_temp.id('orderOpen'), 'Urea', '{"v":"old"}'),
  (pg_temp.id('item3'), pg_temp.id('orderOpen'), 'Creatinina', '{"v":"old"}'),
  (pg_temp.id('itemDone'), pg_temp.id('orderDone'), 'Glucosa', '{"v":"old"}'),
  (pg_temp.id('itemOther'), pg_temp.id('orderOther'), 'Glucosa', '{"v":"old"}');

-- ---------------------------------------------------------------------------
-- B-01: billing totals cover every order (no 1,000-row cap) and only the caller's lab.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('adminA'));
do $$
declare v jsonb;
begin
  v := public.get_billing_totals(pg_temp.id('orgA'), '2026-01-01 00:00-04', '2026-02-01 00:00-04', '2026-02-01 00:00-04');
  perform pg_temp.assert_eq((v->>'total_revenue')::numeric, 3000, 'January revenue over 1,200 orders');
  perform pg_temp.assert_eq((v->>'pending_count')::numeric, 300, 'January pendiente count');
  perform pg_temp.assert_eq((v->>'this_month_revenue')::numeric, 50, 'revenue since month start');

  v := public.get_billing_totals(pg_temp.id('orgA'));
  perform pg_temp.assert_eq((v->>'total_revenue')::numeric, 4150, 'all-time revenue');
  perform pg_temp.assert_eq((v->>'pending_count')::numeric, 300, 'all-time pendiente count');
  perform pg_temp.assert_eq((v->>'this_month_revenue')::numeric, 0, 'no month start given');
end $$;
reset role;

-- Another lab asking for lab A's totals sees nothing.
select pg_temp.act_as(pg_temp.id('adminB'));
do $$
declare v jsonb := public.get_billing_totals(pg_temp.id('orgA'));
begin
  perform pg_temp.assert_eq((v->>'total_revenue')::numeric, 0, 'other lab revenue');
  perform pg_temp.assert_eq((v->>'pending_count')::numeric, 0, 'other lab pending');
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- B-02: affiliate pending balance over 1,100 orders, scoped to the caller's lab.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.assert_eq(public.get_affiliate_pending_balance(pg_temp.id('affA')), 1100, 'affiliate balance (admin)');
reset role;
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.assert_eq(public.get_affiliate_pending_balance(pg_temp.id('affA')), 0, 'affiliate balance (other lab)');
reset role;

-- ---------------------------------------------------------------------------
-- P-04 / B-03: save_order_results saves everything or nothing.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.assert_eq(public.save_order_results(pg_temp.id('orderOpen'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('item1'), 'results_data', '{"v":"new1"}'::jsonb, 'test_method_id', null, 'method_name', 'Enzimatico'),
  jsonb_build_object('item_id', pg_temp.id('item2'), 'results_data', '{"v":"new2"}'::jsonb, 'test_method_id', null, 'method_name', null),
  jsonb_build_object('item_id', pg_temp.id('item3'), 'results_data', null, 'test_method_id', '', 'method_name', null)
)), 3, 'three items saved');
reset role;
select pg_temp.assert_true((select results_data->>'v' = 'new1' and method_name = 'Enzimatico' from public.order_items where id = pg_temp.id('item1')), 'item1 saved');
select pg_temp.assert_true((select results_data->>'v' = 'new2' from public.order_items where id = pg_temp.id('item2')), 'item2 saved');
select pg_temp.assert_true((select results_data is null from public.order_items where id = pg_temp.id('item3')), 'JSON null stored as SQL NULL');

-- One item from another order: nothing is saved.
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('select public.save_order_results(%L, %L::jsonb)', pg_temp.id('orderOpen'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('item1'), 'results_data', '{"v":"partial"}'::jsonb),
  jsonb_build_object('item_id', pg_temp.id('itemOther'), 'results_data', '{"v":"partial"}'::jsonb)
)), 'ORDER_ITEMS_NOT_FOUND');
reset role;
select pg_temp.assert_true((select results_data->>'v' = 'new1' from public.order_items where id = pg_temp.id('item1')), 'item1 untouched after refused save');
select pg_temp.assert_true((select results_data->>'v' = 'old' from public.order_items where id = pg_temp.id('itemOther')), 'other order untouched');

-- Completed orders stay locked.
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.expect_error(format('select public.save_order_results(%L, %L::jsonb)', pg_temp.id('orderDone'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('itemDone'), 'results_data', '{"v":"changed"}'::jsonb)
)), 'ORDER_RESULTS_LOCKED');
reset role;
select pg_temp.assert_true((select results_data->>'v' = 'old' from public.order_items where id = pg_temp.id('itemDone')), 'completed order untouched');

-- Another lab's bioanalyst cannot write lab A's results (RLS hides the rows).
select pg_temp.act_as(pg_temp.id('bioB'));
select pg_temp.expect_error(format('select public.save_order_results(%L, %L::jsonb)', pg_temp.id('orderOpen'), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id('item2'), 'results_data', '{"v":"hacked"}'::jsonb)
)), 'ORDER_ITEMS_NOT_FOUND');
-- Empty payload is refused.
select pg_temp.expect_error(format('select public.save_order_results(%L, %L::jsonb)', pg_temp.id('orderOpen'), '[]'), 'INVALID_RESULTS_PAYLOAD');
reset role;
select pg_temp.assert_true((select results_data->>'v' = 'new2' from public.order_items where id = pg_temp.id('item2')), 'other lab could not write');

do $$ begin raise notice 'Money totals and bulk results passed'; end $$;

rollback;
