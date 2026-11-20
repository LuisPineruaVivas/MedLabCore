-- Authorization columns the client could forge (React Doctor
-- supabase-client-owned-authz-field audit).

-- ---------------------------------------------------------------------------
-- profiles.org_id: "Users can update own profile" only checks id = auth.uid(),
-- so any signed-in user could move their own profile into another lab, keep
-- their role and read that lab's data. Only the role column was guarded.
-- Service-role/system writes (auth.uid() is null) and super admins may still
-- change it.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_org_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and old.org_id is distinct from new.org_id
     and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Permission denied: you cannot change the organization of a profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_org_self_update on public.profiles;
create trigger trg_prevent_org_self_update before update on public.profiles
  for each row execute function public.prevent_org_self_update();

-- ---------------------------------------------------------------------------
-- create_lab_order: the p_created_by check is skipped when auth.uid() is null,
-- and anon could execute it, so an anonymous caller could create orders (and
-- invoices) in any lab as any of its users. The app only calls it signed in;
-- service_role keeps its explicit grant for server-side use.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) from public, anon;
grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) to authenticated, service_role;

