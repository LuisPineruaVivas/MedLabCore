-- Security audit run-1, "needs validation" leads that can be closed in code
-- (applies after 20261019000000_audit_authz_fixes.sql; touches none of its objects).

-- ---------------------------------------------------------------------------
-- supabase/handle_new_user:raw_user_meta_data-role-org_id-trusted
-- raw_user_meta_data is whatever the client sends as auth.signUp options.data,
-- so a self-service signup could pick role lab_admin and any org_id. Role and
-- org now come only from raw_app_meta_data, which only the service role can
-- set (admin-create-user, lab-create-user and create-organization pass them
-- there). super_admin is never granted here: it lives in user_roles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := 'secretary';
  v_org_id uuid;
begin
  if new.raw_app_meta_data ->> 'role' in ('lab_admin', 'bioanalyst', 'secretary', 'lab_affiliate') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
  end if;

  if new.raw_app_meta_data ->> 'org_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_org_id from public.organizations where id = (new.raw_app_meta_data ->> 'org_id')::uuid;
  end if;

  insert into public.profiles (id, full_name, org_id, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_org_id,
    new.email,
    v_role
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The edge functions assume an auth.users trigger creates the profile, but no
-- migration defines it. Create it only when no trigger already runs
-- handle_new_user (the deployed one may have another name), so profiles are
-- never inserted twice. If the migration role cannot create triggers on
-- auth.users, leave a notice instead of failing.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal
      and tgfoid = 'public.handle_new_user()'::regprocedure
  ) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
exception when insufficient_privilege then
  raise notice 'on_auth_user_created not created (insufficient privilege); check the auth.users trigger in the dashboard';
end;
$$;

-- Defence in depth: API callers (anon/authenticated) cannot insert profile rows
-- except super admins. The guards on profiles are BEFORE UPDATE only, so the
-- initial row was unconstrained. handle_new_user (SECURITY DEFINER, so
-- current_user is its owner), GoTrue and the service role are unaffected.
-- SECURITY INVOKER on purpose: current_user must be the API caller's role.
create or replace function public.guard_profile_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated')
     and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'PROFILE_INSERT_FORBIDDEN';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_insert() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_insert on public.profiles;
create trigger trg_guard_profile_insert before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- ---------------------------------------------------------------------------
-- rls/test_templates/global-write-trusts-profiles.role-not-has_role
-- Global rows (org_id is null) were writable by anyone whose profiles.role is
-- super_admin. The super-admin gate everywhere else is has_role (user_roles).
-- The lab_admin branch for the caller's own org is unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert templates for their own organization" on public.test_templates;
create policy "Users can insert templates for their own organization" on public.test_templates
  for insert to authenticated
  with check (
    (org_id is null and public.has_role(auth.uid(), 'super_admin'))
    or (
      org_id = (select profiles.org_id from public.profiles where profiles.id = auth.uid())
      and (select profiles.role from public.profiles where profiles.id = auth.uid()) = 'lab_admin'
    )
  );

drop policy if exists "Users can update their own organization's templates" on public.test_templates;
create policy "Users can update their own organization's templates" on public.test_templates
  for update to authenticated
  using (
    (org_id is null and public.has_role(auth.uid(), 'super_admin'))
    or (
      org_id = (select profiles.org_id from public.profiles where profiles.id = auth.uid())
      and (select profiles.role from public.profiles where profiles.id = auth.uid()) = 'lab_admin'
    )
  )
  with check (
    (org_id is null and public.has_role(auth.uid(), 'super_admin'))
    or (
      org_id = (select profiles.org_id from public.profiles where profiles.id = auth.uid())
      and (select profiles.role from public.profiles where profiles.id = auth.uid()) = 'lab_admin'
    )
  );
