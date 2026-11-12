-- Regression test for migration 20261105000000_onboarding_and_trial_signup.
-- A self-service signup (which also tries to pick a role and another lab through
-- options.data) must get no lab until it confirms its email; confirming creates its
-- own lab with a 7-day trial and makes it lab_admin, once. complete_onboarding only
-- marks the caller. Runs in a transaction and rolls back:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/trial_signup.sql
-- Prints "Trial signup passed".

begin;

create function pg_temp.assert(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAILED: %', p_label;
  end if;
end;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
  'trial@test.dev', 'x', '{"provider":"email"}',
  jsonb_build_object('full_name', 'Ana Prueba', 'lab_name', 'Lab Prueba Trial', 'phone', '04141234567', 'signup', 'trial',
                     'role', 'super_admin', 'org_id', (select id from public.organizations limit 1)),
  now(), now());

select pg_temp.assert(
  (select org_id is null and role = 'secretary' and onboarding_completed_at is null
   from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'unconfirmed signup has no lab, no privileged role, and onboarding pending');
select pg_temp.assert(not exists (select 1 from public.organizations where name = 'Lab Prueba Trial'),
  'no lab before the email is confirmed');

update auth.users set email_confirmed_at = now() where id = '11111111-1111-4111-8111-111111111111';

select pg_temp.assert(
  (select p.role = 'lab_admin' and o.name = 'Lab Prueba Trial' and o.subscription_active
          and o.subscription_expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
   from public.profiles p join public.organizations o on o.id = p.org_id
   where p.id = '11111111-1111-4111-8111-111111111111'),
  'confirming creates its own lab with a 7-day trial and makes it lab_admin');
select pg_temp.assert(public.has_role('11111111-1111-4111-8111-111111111111', 'lab_admin'), 'has_role(lab_admin) passes');

update auth.users set email_confirmed_at = null where id = '11111111-1111-4111-8111-111111111111';
update auth.users set email_confirmed_at = now() where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.assert((select count(*) = 1 from public.organizations where name = 'Lab Prueba Trial'), 'a second confirmation creates no second lab');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.complete_onboarding();
reset role;
select pg_temp.assert(
  (select onboarding_completed_at is not null from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'complete_onboarding marks the caller');
select pg_temp.assert(not exists (select 1 from public.profiles where onboarding_completed_at is null and id <> '11111111-1111-4111-8111-111111111111'),
  'existing users were backfilled');

-- An account born confirmed (email confirmations off) also gets its lab.
-- GoTrue inserts users with no JWT in the session, unlike the complete_onboarding call above.
select set_config('request.jwt.claims', '', true);
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
  'trial2@test.dev', 'x', '{"provider":"email"}',
  '{"full_name":"Luis Prueba","lab_name":"Lab Auto Confirmado","signup":"trial"}', now(), now(), now());
select pg_temp.assert(
  (select p.role = 'lab_admin' and o.name = 'Lab Auto Confirmado'
   from public.profiles p join public.organizations o on o.id = p.org_id
   where p.id = '22222222-2222-4222-8222-222222222222'),
  'an account created already confirmed gets its lab');

select 'Trial signup passed';
rollback;
