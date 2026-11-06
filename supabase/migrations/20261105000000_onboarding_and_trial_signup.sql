-- Onboarding guide flag + 7-day free trial for self-service signups.
--
-- Prerequisite (already in prod since 20261019010000_audit_nv_fixes): handle_new_user
-- reads role/org_id only from raw_app_meta_data, so a self-service signup gets a
-- profile with no org and role secretary, whatever it sends in options.data.

-- ---------------------------------------------------------------------------
-- 1. Onboarding guide: shown to lab admins until they finish or dismiss it.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

-- Everyone who already uses the system has, in effect, finished onboarding.
update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;

create or replace function public.complete_onboarding()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = auth.uid();
$$;

revoke execute on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Free trial: when a self-service signup confirms its email, create its lab
--    with 7 days of subscription and make the user its lab_admin.
--    Signups that never confirm leave no lab behind.
-- ---------------------------------------------------------------------------
create or replace function public.handle_trial_signup_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lab_name text := left(nullif(trim(new.raw_user_meta_data ->> 'lab_name'), ''), 120);
  v_org_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null then
      return new;
    end if;
  end if;
  if new.email_confirmed_at is null
     or coalesce(new.raw_user_meta_data ->> 'signup', '') <> 'trial'
     or v_lab_name is null then
    return new;
  end if;

  -- Users created by an admin already belong to a lab (org_id from app_metadata).
  if not exists (select 1 from public.profiles where id = new.id and org_id is null) then
    return new;
  end if;

  insert into public.organizations (name, email, phone, subscription_active, subscription_expires_at)
  values (
    v_lab_name,
    new.email,
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 30),
    true,
    now() + interval '7 days'
  )
  returning id into v_org_id;

  -- auth.uid() is null here (GoTrue confirms the email), so the profile guards let this through.
  update public.profiles set org_id = v_org_id, role = 'lab_admin' where id = new.id;

  -- Until 20261027000000_roles_single_source is deployed, has_role(lab_admin) also needs a
  -- user_roles row. After it, user_roles only accepts super_admin rows and this insert is skipped.
  begin
    insert into public.user_roles (user_id, role) values (new.id, 'lab_admin') on conflict do nothing;
  exception when check_violation then
    null;
  end;

  return new;
end;
$$;

revoke execute on function public.handle_trial_signup_confirmed() from public, anon, authenticated;

-- on_auth_user_confirmed: the normal path (email confirmation on).
-- on_auth_user_trial_created: an account that is born confirmed (confirmations off, e.g. local dev).
-- Its name sorts after on_auth_user_created, so the profile already exists when it runs.
do $$
begin
  drop trigger if exists on_auth_user_confirmed on auth.users;
  create trigger on_auth_user_confirmed
    after update of email_confirmed_at on auth.users
    for each row execute function public.handle_trial_signup_confirmed();
  drop trigger if exists on_auth_user_trial_created on auth.users;
  create trigger on_auth_user_trial_created
    after insert on auth.users
    for each row execute function public.handle_trial_signup_confirmed();
exception when insufficient_privilege then
  raise notice 'trial signup triggers not created (insufficient privilege); create them from the SQL editor';
end;
$$;
