-- S-09: one source of truth for roles.
--
-- Before: the app, get_my_role(), erp_user_has_role() and most RLS policies read
-- profiles.role, while has_role() read user_roles. Since 20261019010000 nothing
-- writes lab roles to user_roles any more (handle_new_user only fills profiles),
-- so the two drifted apart:
--   - a lab admin with no user_roles row failed has_role(lab_admin) and was
--     denied on exchange_rates, exam_profiles, profile_templates_junction,
--     organization_test_category_settings and audit_logs;
--   - a stale user_roles row granted a role the user no longer has in the app
--     (e.g. a secretary that still passed has_role(lab_admin)).
--
-- After:
--   - lab roles (lab_admin, bioanalyst, secretary, lab_affiliate) come only from
--     profiles.role, one role per user;
--   - super_admin stays behind its own check: a user_roles row, which only the
--     service role or another super admin can write. profiles.role can be set
--     by a super admin too, but it never grants super-admin access by itself.
--   - user_roles keeps only super_admin rows (CHECK constraint).
-- Every has_role() caller (policies, triggers, edge functions) is fixed by the
-- function change alone; no policy is rewritten.

-- 1. Report drift before cleaning up (shows in the `supabase db push` output).
do $$
declare
  v_missing int;
  v_differ int;
  v_super_only_table int;
  v_super_only_profile int;
begin
  select count(*) into v_missing
  from public.profiles p
  where p.role <> 'super_admin'
    and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = p.role);

  select count(*) into v_differ
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role <> 'super_admin'
  where ur.role <> p.role;

  select count(*) into v_super_only_table
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role = 'super_admin' and p.role <> 'super_admin';

  select count(*) into v_super_only_profile
  from public.profiles p
  where p.role = 'super_admin'
    and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'super_admin');

  raise notice 'S-09 roles: % profiles had no matching user_roles row (now fixed: has_role reads profiles)', v_missing;
  raise notice 'S-09 roles: % stale user_roles rows disagreed with profiles.role (removed)', v_differ;
  raise notice 'S-09 roles: % super admins by user_roles whose profiles.role is not super_admin (still super admins)', v_super_only_table;
  raise notice 'S-09 roles: % profiles say super_admin without a user_roles row (NOT super admins; unchanged from before)', v_super_only_profile;
end;
$$;

-- 2. has_role: profiles.role for lab roles, user_roles for super_admin.
create or replace function public.has_role(_user_id uuid, _role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _role = 'super_admin' then exists (
      select 1 from public.user_roles where user_id = _user_id and role = 'super_admin'
    )
    else exists (
      select 1 from public.profiles where id = _user_id and role = _role
    )
  end
$$;

-- 3. user_roles holds only super admins from now on.
delete from public.user_roles where role <> 'super_admin';

alter table public.user_roles drop constraint if exists user_roles_super_admin_only;
alter table public.user_roles
  add constraint user_roles_super_admin_only check (role = 'super_admin');

alter table public.user_roles alter column role set default 'super_admin';

comment on table public.user_roles is
  'Super-admin grants only. Lab roles live in profiles.role (S-09); has_role() reads both.';
