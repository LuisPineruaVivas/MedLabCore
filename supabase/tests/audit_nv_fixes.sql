-- Regression test for migration 20261019010000_audit_nv_fixes.sql (security
-- audit run-1 "needs validation" leads). Runs inside a transaction and rolls
-- back, so it leaves no data behind. If the migration is not applied yet,
-- prepend it:
--   (echo "begin;"; cat supabase/migrations/20261019010000_audit_nv_fixes.sql; cat supabase/tests/audit_nv_fixes.sql) \
--     | docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q
-- Aborts on the first failure; prints "Audit NV fixes passed" otherwise.

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

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Static checks.
do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
      and tgfoid = 'public.handle_new_user()'::regprocedure
  ) then raise exception 'no auth.users trigger runs handle_new_user'; end if;
  if (select count(*) from pg_trigger
      where tgrelid = 'auth.users'::regclass and not tgisinternal
        and tgfoid = 'public.handle_new_user()'::regprocedure) > 1
  then raise exception 'more than one auth.users trigger runs handle_new_user'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_guard_profile_insert' and tgrelid = 'public.profiles'::regclass) then
    raise exception 'trg_guard_profile_insert is missing on profiles';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'test_templates'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'super_admin'
      and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'has_role'
  ) then raise exception 'a test_templates policy still checks super_admin without has_role'; end if;
end $$;

-- Fixtures: two labs, a pseudo super admin (profiles.role only, no user_roles
-- row), the real super admin and a lab_admin.
create temp table fx (
  org_a uuid, org_b uuid, pseudo uuid, super_admin uuid, lab_admin uuid,
  signup uuid, staff uuid, tpl uuid
) on commit drop;
insert into fx (org_a, org_b, signup, staff, pseudo)
select
  (select id from public.organizations order by id limit 1),
  (select id from public.organizations order by id offset 1 limit 1),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
update fx set
  super_admin = (select user_id from public.user_roles where role = 'super_admin' limit 1),
  lab_admin = (select p.id from public.profiles p
               where p.role = 'lab_admin' and p.org_id is not null
                 and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'super_admin')
               limit 1);
update fx set org_a = (select org_id from public.profiles where id = fx.lab_admin);
update fx set org_b = (select id from public.organizations where id <> fx.org_a limit 1);
grant select on fx to authenticated, anon;

do $$ begin
  if (select org_b is null or super_admin is null or lab_admin is null from fx) then
    raise exception 'Fixtures need two labs, a super_admin in user_roles and a lab_admin';
  end if;
end $$;

-- 1. A self-service signup (client-controlled raw_user_meta_data) that asks for
--    lab_admin of another lab gets the default role and no org.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select signup, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'nv-signup-' || signup || '@example.test',
       jsonb_build_object('full_name', 'Forged', 'role', 'lab_admin', 'org_id', org_b),
       '{"provider":"email","providers":["email"]}'::jsonb, now(), now()
from fx;
do $$ declare r record; begin
  select p.role, p.org_id, p.full_name into r from public.profiles p, fx where p.id = fx.signup;
  if r is null then raise exception 'handle_new_user did not create the signup profile'; end if;
  if r.role <> 'secretary' or r.org_id is not null then
    raise exception 'forged signup metadata was trusted: role %, org %', r.role, r.org_id;
  end if;
  if r.full_name <> 'Forged' then raise exception 'full_name not copied from user metadata'; end if;
end $$;

-- ...and that account reads no patients of the lab it asked for.
savepoint s;
select pg_temp.act_as((select signup from fx));
do $$ begin
  if exists (select 1 from public.patients where org_id = (select org_b from fx)) then
    raise exception 'forged signup can read patients of another lab';
  end if;
end $$;
rollback to savepoint s;

-- 2. A service-role createUser with app_metadata (what the edge functions now
--    send) gets the requested role and org; super_admin is never granted here.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'nv-staff-' || staff || '@example.test',
       jsonb_build_object('full_name', 'Staff'),
       jsonb_build_object('provider', 'email', 'role', 'bioanalyst', 'org_id', org_a), now(), now()
from fx;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select pseudo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'nv-pseudo-' || pseudo || '@example.test',
       '{}'::jsonb, jsonb_build_object('role', 'super_admin', 'org_id', 'not-a-uuid'), now(), now()
from fx;
do $$ declare r record; begin
  select p.role, p.org_id into r from public.profiles p, fx where p.id = fx.staff;
  if r.role <> 'bioanalyst' or r.org_id is distinct from (select org_a from fx) then
    raise exception 'app_metadata role/org not applied: role %, org %', r.role, r.org_id;
  end if;
  select p.role, p.org_id into r from public.profiles p, fx where p.id = fx.pseudo;
  if r.role <> 'secretary' or r.org_id is not null then
    raise exception 'app_metadata super_admin or bad org_id accepted: role %, org %', r.role, r.org_id;
  end if;
end $$;

-- 3. API callers cannot insert profile rows (BEFORE INSERT guard).
savepoint s;
select pg_temp.act_as((select signup from fx));
select pg_temp.expect_error(
  format('insert into public.profiles (id, full_name, org_id, role) values (%L, %L, %L, %L)',
         (select signup from fx), 'x', (select org_b from fx), 'lab_admin'),
  'PROFILE_INSERT_FORBIDDEN');
rollback to savepoint s;
savepoint s;
select pg_temp.act_as((select lab_admin from fx));
select pg_temp.expect_error(
  format('insert into public.profiles (id, full_name, org_id, role) values (%L, %L, %L, %L)',
         gen_random_uuid(), 'x', (select org_a from fx), 'bioanalyst'),
  'PROFILE_INSERT_FORBIDDEN');
rollback to savepoint s;

-- 4. Global test_templates: a pseudo super admin (profiles.role = super_admin,
--    no user_roles row, as the old handle_new_user could create) can neither
--    insert nor update global rows; the real super admin and a lab_admin on
--    its own org still can.
update public.profiles set role = 'super_admin' where id = (select pseudo from fx);
insert into public.test_templates (name, category, org_id, is_active)
values ('nv-global-tpl', 'nv', null, true) returning id \gset tpl_
update fx set tpl = :'tpl_id';

savepoint s;
select pg_temp.act_as((select pseudo from fx));
select pg_temp.expect_error(
  $q$insert into public.test_templates (name, category, org_id, is_active) values ('nv-pseudo-insert', 'nv', null, true)$q$,
  'row-level security');
do $$ declare n int; begin
  update public.test_templates set name = 'nv-pseudo-update' where id = (select tpl from fx);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'pseudo super admin updated a global template'; end if;
end $$;
rollback to savepoint s;

savepoint s;
select pg_temp.act_as((select super_admin from fx));
insert into public.test_templates (name, category, org_id, is_active) values ('nv-super-insert', 'nv', null, true);
do $$ declare n int; begin
  update public.test_templates set name = 'nv-super-update' where id = (select tpl from fx);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'super admin could not update a global template'; end if;
end $$;
rollback to savepoint s;

savepoint s;
select pg_temp.act_as((select lab_admin from fx));
select pg_temp.expect_error(
  $q$insert into public.test_templates (name, category, org_id, is_active) values ('nv-lab-global', 'nv', null, true)$q$,
  'row-level security');
insert into public.test_templates (name, category, org_id, is_active) values ('nv-lab-own', 'nv', (select org_a from fx), true);
do $$ declare n int; begin
  update public.test_templates set name = 'nv-lab-own-2' where name = 'nv-lab-own' and org_id = (select org_a from fx);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'lab_admin could not update its own template'; end if;
  update public.test_templates set name = 'nv-lab-global-2' where id = (select tpl from fx);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'lab_admin updated a global template'; end if;
end $$;
select pg_temp.expect_error(
  format($q$insert into public.test_templates (name, category, org_id, is_active) values ('nv-lab-other', 'nv', %L, true)$q$, (select org_b from fx)),
  'row-level security');
rollback to savepoint s;

do $$ begin raise notice 'Audit NV fixes passed'; end $$;

rollback;
