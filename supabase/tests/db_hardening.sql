-- Test for migration 20261025030000_db_hardening (improvement plan S-07).
-- For each item: refused for the role that lost access, still allowed for the roles
-- the app needs. Runs inside a transaction and rolls back:
--   npm run test:db -- db_hardening
-- Prints "DB hardening passed".

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

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end;
$$;

-- Number of rows a statement affected, run as the current role (RLS hides rows silently).
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (written as postgres).
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('bioA', gen_random_uuid()), ('secA', gen_random_uuid()), ('affA', gen_random_uuid()),
  ('adminB', gen_random_uuid()), ('patientA', gen_random_uuid()), ('orderA', gen_random_uuid()), ('itemA', gen_random_uuid()),
  ('templateA', gen_random_uuid()), ('templateG', gen_random_uuid()), ('templateB', gen_random_uuid());
grant select on ids to authenticated, anon;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, is_active, subscription_active, email) values
  (pg_temp.id('orgA'), 'Hardening A', true, true, 'a@hardening-test.local'),
  (pg_temp.id('orgB'), 'Hardening B', true, true, 'b@hardening-test.local');

insert into auth.users (id, email)
select v, k || '@hardening-test.local' from ids where k in ('adminA', 'bioA', 'secA', 'affA', 'adminB');

insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@hardening-test.local'),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@hardening-test.local'),
  (pg_temp.id('secA'), pg_temp.id('orgA'), 'secretary', 'Sec A', 'secA@hardening-test.local'),
  (pg_temp.id('affA'), pg_temp.id('orgA'), 'lab_affiliate', 'Aff A', 'affA@hardening-test.local'),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@hardening-test.local')
-- The auth.users trigger (handle_new_user) may already have created the profile.
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name, email = excluded.email;

delete from public.user_roles where user_id in (select v from ids);
-- Lab roles come from profiles.role (S-09); user_roles holds super admins only.

insert into public.test_templates (id, org_id, name, category, base_price, is_active) values
  (pg_temp.id('templateA'), pg_temp.id('orgA'), 'Hardening A Test', 'Hardening', 10, true),
  (pg_temp.id('templateG'), null, 'Hardening Global Test', 'Hardening', 10, true),
  (pg_temp.id('templateB'), pg_temp.id('orgB'), 'Hardening B Test', 'Hardening', 10, true);

insert into public.organization_exam_settings (org_id, template_id, custom_sort_order)
values (pg_temp.id('orgA'), pg_temp.id('templateA'), 1);

insert into public.exchange_rates (org_id, rate) values (pg_temp.id('orgA'), 40), (pg_temp.id('orgB'), 41);

insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patientA'), pg_temp.id('orgA'), 'HARD-A-1', 'Paciente', 'A', '1990-01-01', 'femenino', pg_temp.id('adminA'));
insert into public.orders (id, org_id, patient_id, created_by, total_amount, status)
values (pg_temp.id('orderA'), pg_temp.id('orgA'), pg_temp.id('patientA'), pg_temp.id('adminA'), 0, 'procesando');
insert into public.order_items (id, order_id, test_name, results_data)
values (pg_temp.id('itemA'), pg_temp.id('orderA'), 'Glucosa', '{"v":"old"}');

-- ---------------------------------------------------------------------------
-- 1. antibiotics: affiliate refused; secretary (enters results) and bioanalyst allowed.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.expect_error(format('insert into public.antibiotics (org_id, name) values (%L, %L)', pg_temp.id('orgA'), 'Aff Antibiotic'), 'row-level security');
reset role;
select pg_temp.act_as(pg_temp.id('secA'));
insert into public.antibiotics (org_id, name) values (pg_temp.id('orgA'), 'Sec Antibiotic');
reset role;
select pg_temp.act_as(pg_temp.id('bioA'));
insert into public.antibiotics (org_id, name) values (pg_temp.id('orgA'), 'Bio Antibiotic');
reset role;
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_true(pg_temp.affected(format('update public.antibiotics set name = %L where org_id = %L', 'hacked', pg_temp.id('orgA'))) = 0, 'affiliate cannot edit antibiotics');
select pg_temp.assert_true((select count(*) from public.antibiotics where org_id = pg_temp.id('orgA')) = 2, 'affiliate still reads antibiotics');
reset role;

-- ---------------------------------------------------------------------------
-- 2. organization_exam_settings: everyone in the lab reads; only admin/bioanalyst write.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.assert_true((select count(*) from public.organization_exam_settings where org_id = pg_temp.id('orgA')) = 1, 'secretary reads exam settings');
select pg_temp.assert_true(pg_temp.affected(format('update public.organization_exam_settings set custom_sort_order = 99 where org_id = %L', pg_temp.id('orgA'))) = 0, 'secretary cannot edit exam settings');
reset role;
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_true(pg_temp.affected(format('update public.organization_exam_settings set custom_sort_order = 99 where org_id = %L', pg_temp.id('orgA'))) = 0, 'affiliate cannot edit exam settings');
reset role;
select pg_temp.act_as(pg_temp.id('bioA'));
select pg_temp.assert_true(pg_temp.affected(format('update public.organization_exam_settings set custom_sort_order = 2 where org_id = %L', pg_temp.id('orgA'))) = 1, 'bioanalyst edits exam settings');
reset role;
select pg_temp.act_as(pg_temp.id('adminB'));
select pg_temp.assert_true((select count(*) from public.organization_exam_settings where org_id = pg_temp.id('orgA')) = 0, 'other lab cannot read exam settings');
reset role;

-- ---------------------------------------------------------------------------
-- 3. exchange_rates: anon reads nothing; users read their own lab's rate only.
-- ---------------------------------------------------------------------------
select pg_temp.act_as_anon();
select pg_temp.assert_true((select count(*) from public.exchange_rates) = 0, 'anon reads no exchange rates');
reset role;
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_true((select count(*) = 1 and min(rate) = 40 from public.exchange_rates where org_id in (pg_temp.id('orgA'), pg_temp.id('orgB'))), 'user reads own lab rate only');
reset role;

-- ---------------------------------------------------------------------------
-- 4. v_test_templates_filtered: anon refused; users see global + own lab, not others.
-- ---------------------------------------------------------------------------
select pg_temp.act_as_anon();
select pg_temp.expect_error('select count(*) from public.v_test_templates_filtered', 'permission denied');
reset role;
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.assert_true((select count(*) from public.v_test_templates_filtered where id in (pg_temp.id('templateA'), pg_temp.id('templateG'))) = 2, 'view shows own + global templates');
select pg_temp.assert_true(not exists (select 1 from public.v_test_templates_filtered where id = pg_temp.id('templateB')), 'view hides other labs');
reset role;
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.v_test_templates_filtered', 'insert,update,delete'), 'view is read-only');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.v_test_templates_filtered', 'select'), 'anon has no view access');

-- ---------------------------------------------------------------------------
-- 5. profiles: affiliate sees only itself; staff still see the whole lab.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('affA'));
select pg_temp.assert_true((select array_agg(id) = array[pg_temp.id('affA')] from public.profiles where org_id = pg_temp.id('orgA')), 'affiliate sees only own profile');
reset role;
select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.assert_true((select count(*) from public.profiles where org_id = pg_temp.id('orgA')) = 4, 'staff see the lab team');
reset role;

-- ---------------------------------------------------------------------------
-- 6. get_my_org_id has a fixed search_path.
-- ---------------------------------------------------------------------------
select pg_temp.assert_true((select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.get_my_org_id()'::regprocedure), 'get_my_org_id search_path');

-- ---------------------------------------------------------------------------
-- 7. Editing results writes an audit entry with the old and new values; other
--    updates (no result change) do not.
-- ---------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('bioA'));
update public.order_items set results_data = '{"v":"new"}' where id = pg_temp.id('itemA');
update public.order_items set price_at_order = price_at_order where id = pg_temp.id('itemA');
reset role;
select pg_temp.assert_true((select count(*) = 1 from public.audit_logs where action = 'ORDER_RESULTS_UPDATED' and entity_id = pg_temp.id('orderA')), 'one audit entry for the results edit');
select pg_temp.assert_true((select org_id = pg_temp.id('orgA') and user_id = pg_temp.id('bioA')
  and metadata->'old_results'->>'v' = 'old' and metadata->'new_results'->>'v' = 'new' and metadata->>'test_name' = 'Glucosa'
  from public.audit_logs where action = 'ORDER_RESULTS_UPDATED' and entity_id = pg_temp.id('orderA')), 'audit entry content');

do $$ begin raise notice 'DB hardening passed'; end $$;

rollback;
