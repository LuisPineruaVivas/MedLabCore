-- Free-trial limits: a self-service trial lab can register at most 10 patients and 20 orders
-- until a subscription payment is approved, so a bot (or a lab running on the trial) can't
-- fill the database. Labs created by the super admin are never trials.

alter table public.organizations add column if not exists is_trial boolean not null default false;

-- Trial labs that already exist: created by the signup trigger and never paid.
update public.organizations o
set is_trial = true
where not o.is_trial
  and exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.org_id = o.id and u.raw_user_meta_data ->> 'signup' = 'trial'
  )
  and not exists (select 1 from public.subscription_payments sp where sp.org_id = o.id and sp.status = 'approved');

-- Same as 20261105000000_onboarding_and_trial_signup, plus is_trial = true on the new lab.
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

  insert into public.organizations (name, email, phone, subscription_active, subscription_expires_at, is_trial)
  values (
    v_lab_name,
    new.email,
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 30),
    true,
    now() + interval '7 days',
    true
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

-- Blocks the insert once a trial lab reaches its limit. The limit ends when any subscription
-- payment of the lab is approved (approve_subscription_payment), with no change to that RPC.
create or replace function public.enforce_trial_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int := case tg_table_name when 'patients' then 10 else 20 end;
  v_count int;
begin
  if not exists (select 1 from public.organizations where id = new.org_id and is_trial)
     or exists (select 1 from public.subscription_payments where org_id = new.org_id and status = 'approved') then
    return new;
  end if;

  -- Serializes concurrent inserts of one trial lab, so parallel requests can't overshoot the limit.
  perform pg_advisory_xact_lock(hashtext('trial_limit:' || tg_table_name || ':' || new.org_id::text));

  if tg_table_name = 'patients' then
    select count(*) into v_count from public.patients where org_id = new.org_id;
  else
    select count(*) into v_count from public.orders where org_id = new.org_id;
  end if;

  if v_count >= v_limit then
    raise exception 'La prueba gratuita permite hasta % %. Activa tu suscripción para seguir registrando.',
      v_limit, case tg_table_name when 'patients' then 'pacientes' else 'órdenes' end
      using errcode = 'P0001', hint = 'TRIAL_LIMIT';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_trial_limits() from public, anon, authenticated;

drop trigger if exists enforce_trial_limits on public.patients;
create trigger enforce_trial_limits before insert on public.patients
  for each row execute function public.enforce_trial_limits();

drop trigger if exists enforce_trial_limits on public.orders;
create trigger enforce_trial_limits before insert on public.orders
  for each row execute function public.enforce_trial_limits();
