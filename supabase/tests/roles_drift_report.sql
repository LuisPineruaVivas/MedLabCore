-- READ-ONLY report for S-09 (migration 20261027000000_roles_single_source). Changes nothing.
-- Run it on production BEFORE `supabase db push` (Supabase > SQL Editor) to see who
-- gains or loses access when has_role() switches from user_roles to profiles.role.
-- Shows counts and emails only for rows that change (no other personal data).
-- After the push the first line counts every lab user (user_roles keeps only super
-- admins by then), so the report is only meaningful before it.

-- Summary.
select 'profiles without a matching user_roles row (GAIN: has_role now follows their app role)' as check, count(*)::text as result
from public.profiles p
where p.role <> 'super_admin'
  and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = p.role)
union all
select 'stale user_roles rows that differ from profiles.role (LOSE that extra role; rows deleted)', count(*)::text
from public.user_roles ur join public.profiles p on p.id = ur.user_id
where ur.role <> 'super_admin' and ur.role <> p.role
union all
select 'super admins in user_roles (unchanged)', count(*)::text
from public.user_roles where role = 'super_admin'
union all
select 'profiles.role = super_admin WITHOUT user_roles grant (were and stay NOT super admin)', count(*)::text
from public.profiles p
where p.role = 'super_admin'
  and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'super_admin');

-- Detail of the users whose has_role() result changes for a lab role.
select p.email, p.role::text as app_role, ur.role::text as stale_user_roles_role
from public.user_roles ur join public.profiles p on p.id = ur.user_id
where ur.role <> 'super_admin' and ur.role <> p.role
order by p.email;
