-- Test for migration 20261027000000_roles_single_source (improvement plan S-09).
-- Lab roles come only from profiles.role; super_admin only from user_roles.
-- Runs inside a transaction and rolls back:
--   npm run test:db -- roles_single_source
-- Prints "Roles single source passed".

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
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

-- ---------------------------------------------------------------------------
-- Fixtures (written as postgres).
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('bioA', gen_random_uuid()), ('secA', gen_random_uuid()),
  ('pseudoSuper', gen_random_uuid()), ('realSuper', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into public.organizations (id, name, is_active, subscription_active, email) values
  (pg_temp.id('orgA'), 'Roles A', true, true, 'a@roles-test.local');

insert into auth.users (id, email)
select v, k || '@roles-test.local' from ids where k <> 'orgA';

insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@roles-test.local'),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@roles-test.local'),
  (pg_temp.id('secA'), pg_temp.id('orgA'), 'secretary', 'Sec A', 'secA@roles-test.local'),
  -- profiles.role says super_admin, but there is no user_roles grant.
  (pg_temp.id('pseudoSuper'), pg_temp.id('orgA'), 'super_admin', 'Pseudo', 'pseudoSuper@roles-test.local'),
  (pg_temp.id('realSuper'), null, 'super_admin', 'Super', 'realSuper@roles-test.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name, email = excluded.email;

delete from public.user_roles where user_id in (select v from ids);
insert into public.user_roles (user_id, role) values (pg_temp.id('realSuper'), 'super_admin');

-- ---------------------------------------------------------------------------
-- 1. has_role reads profiles.role for lab roles (no user_roles row needed).
-- ---------------------------------------------------------------------------
select pg_temp.assert_true(public.has_role(pg_temp.id('adminA'), 'lab_admin'), 'lab admin without user_roles row passes has_role(lab_admin)');
select pg_temp.assert_true(public.has_role(pg_temp.id('bioA'), 'bioanalyst'), 'bioanalyst passes has_role(bioanalyst)');
select pg_temp.assert_true(not public.has_role(pg_temp.id('secA'), 'lab_admin'), 'secretary fails has_role(lab_admin)');
select pg_temp.assert_true(not public.has_role(pg_temp.id('bioA'), 'lab_admin'), 'bioanalyst fails has_role(lab_admin)');

-- 2. super_admin only through user_roles.
select pg_temp.assert_true(public.has_role(pg_temp.id('realSuper'), 'super_admin'), 'user_roles super admin passes');
select pg_temp.assert_true(not public.has_role(pg_temp.id('pseudoSuper'), 'super_admin'), 'profiles-only super_admin fails');
select pg_temp.assert_true(not public.has_role(pg_temp.id('realSuper'), 'lab_admin'), 'super admin is not a lab admin by has_role');

-- 3. user_roles accepts only super_admin rows.
select pg_temp.expect_error(
  format('insert into public.user_roles (user_id, role) values (%L, %L)', pg_temp.id('secA'), 'lab_admin'),
  'user_roles_super_admin_only');

-- 4. The policies that call has_role(lab_admin) now follow profiles.role.
select pg_temp.act_as(pg_temp.id('adminA'));
insert into public.exchange_rates (org_id, rate) values (pg_temp.id('orgA'), 40);
reset role;

select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(
  format('insert into public.exchange_rates (org_id, rate) values (%L, 41)', pg_temp.id('orgA')),
  'row-level security');
reset role;

-- 5. Nobody grants themselves super_admin.
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(
  format('insert into public.user_roles (user_id, role) values (%L, %L)', pg_temp.id('adminA'), 'super_admin'),
  'row-level security');
reset role;

-- 6. A lab admin still cannot change their own role (prevent_role_self_update uses has_role).
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(
  format('update public.profiles set role = %L where id = %L', 'super_admin', pg_temp.id('adminA')),
  'cannot modify your own role');
reset role;

do $$ begin raise notice 'Roles single source passed'; end $$;
rollback;
