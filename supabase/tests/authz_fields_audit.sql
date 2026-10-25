-- Regression test for client-forgeable authorization columns
-- (migrations 20261018000005 and 20261018000006). Runs inside a transaction and
-- rolls back, so it leaves no data behind. Uses existing rows from two labs:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/authz_fields_audit.sql
-- Aborts on the first failure; prints "Authz fields audit passed" otherwise.

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
do $$
declare v_fn text := 'public.create_lab_order(uuid,uuid,text,numeric,numeric,boolean,jsonb,uuid)';
begin
  if has_function_privilege('anon', v_fn, 'execute') then raise exception 'anon can execute create_lab_order'; end if;
  if not has_function_privilege('authenticated', v_fn, 'execute') then raise exception 'authenticated lost execute on create_lab_order'; end if;
  if not has_function_privilege('service_role', v_fn, 'execute') then raise exception 'service_role lost execute on create_lab_order'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_org_self_update' and tgrelid = 'public.profiles'::regclass) then
    raise exception 'trg_prevent_org_self_update is missing on profiles';
  end if;
end;
$$;

-- Fixtures: a non-super-admin user, and another lab with one of its users.
create temp table fx on commit drop as
select
  (select id from public.profiles where role in ('secretary', 'bioanalyst', 'lab_admin') order by role desc limit 1) as staff,
  (select id from public.profiles where role = 'super_admin' limit 1) as super_admin,
  null::uuid as staff_org, null::uuid as other_org, null::uuid as other_user;
update fx set staff_org = (select org_id from public.profiles where id = fx.staff);
update fx set other_org = (select id from public.organizations where id <> fx.staff_org limit 1);
update fx set other_user = (select id from public.profiles where org_id = fx.other_org limit 1);
grant select on fx to authenticated, anon;

do $$ begin
  if (select staff is null or other_org is null from fx) then raise exception 'Fixtures need a staff user and at least two labs'; end if;
end $$;

-- 1. Staff cannot move their own profile into another lab...
savepoint s;
select pg_temp.act_as((select staff from fx));
select pg_temp.expect_error(format('update public.profiles set org_id = %L where id = auth.uid()', (select other_org from fx)), 'cannot change the organization');
-- ...but can still edit their own signature fields.
do $$ begin
  update public.profiles set signature_footer_text = 'authz-audit' where id = auth.uid();
  if not found then raise exception 'Staff could not update their own signature footer'; end if;
end $$;
rollback to savepoint s;

-- 2. Super admins can still move a profile between labs.
do $$ declare v_sa uuid := (select super_admin from fx); begin
  if v_sa is null then raise notice 'No super_admin fixture; skipping check 2'; return; end if;
  perform pg_temp.act_as(v_sa);
  update public.profiles set org_id = (select other_org from fx) where id = (select staff from fx);
  if not found then raise exception 'Super admin could not move a profile'; end if;
end $$;
rollback to savepoint s;

-- 3. Anonymous callers cannot create orders.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect_error(
  format('select public.create_lab_order(%L, gen_random_uuid(), null, 0, null, false, %L, %L)', (select other_org from fx), '[]', (select other_user from fx)),
  'permission denied');
rollback to savepoint s;

-- 4. ERP only: exchange_rate_history.created_by is stamped from the session.
do $$ declare v_admin uuid; v_org uuid; v_created_by uuid; begin
  if to_regclass('public.exchange_rate_history') is null then raise notice 'ERP not installed; skipping check 4'; return; end if;
  select p.id, p.org_id into v_admin, v_org from public.profiles p join public.organizations o on o.id = p.org_id
    where p.role = 'lab_admin' and o.has_erp_module limit 1;
  if v_admin is null then raise notice 'No ERP lab_admin fixture; skipping check 4'; return; end if;
  perform pg_temp.act_as(v_admin);
  insert into public.exchange_rate_history (org_id, rate, effective_date, created_by, source)
    values (v_org, 1, date '2099-12-31', (select other_user from fx), 'manual')
    returning created_by into v_created_by;
  if v_created_by is distinct from v_admin then raise exception 'exchange_rate_history.created_by was not stamped with the caller'; end if;
end $$;
rollback to savepoint s;

do $$ begin raise notice 'Authz fields audit passed'; end $$;
rollback;
