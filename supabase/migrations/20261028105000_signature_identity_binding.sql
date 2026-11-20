-- Security audit run-2: supabase/profiles:self-writable-signature-identity-copied-by-guard_order_update (medium).
--
-- Signing copies firma_url, full_name, sello_url and signature_footer_text from the
-- signer's own profile, but every user could write those columns on their own profile.
-- A bioanalyst could copy a colleague's name, signature and stamp into their profile and
-- sign reports as that colleague.
--
-- 1. Profile guard (API callers, not super admins):
--    - firma_url / sello_url must be empty or point into the caller's own storage folder
--      firms_stamps/<auth.uid()>/ (the only place the app uploads them);
--    - full_name can only be changed by a super admin (the app never edits it; names
--      are set when the account is created).
-- 2. orders.signed_by records who actually signed, on every signing path (direct
--    completion and ERP confirm_order_consumption), so the footer text, which stays
--    free for credentials, is no longer the only trace of the signer.

create or replace function public.guard_profile_signature_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_own_folder text := '%/firms_stamps/' || auth.uid()::text || '/%';
begin
  if not public.is_api_caller() or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;
  if new.firma_url is distinct from old.firma_url and new.firma_url is not null and new.firma_url not like v_own_folder then
    raise exception 'SIGNATURE_URL_NOT_OWNED' using errcode = '42501';
  end if;
  if new.sello_url is distinct from old.sello_url and new.sello_url is not null and new.sello_url not like v_own_folder then
    raise exception 'SIGNATURE_URL_NOT_OWNED' using errcode = '42501';
  end if;
  if new.full_name is distinct from old.full_name then
    raise exception 'PROFILE_NAME_ADMIN_ONLY' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_signature_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_profile_signature_fields on public.profiles;
create trigger trg_guard_profile_signature_fields before update on public.profiles
  for each row execute function public.guard_profile_signature_fields();

alter table public.orders add column if not exists signed_by uuid references auth.users(id) on delete set null;
comment on column public.orders.signed_by is 'User who signed (completed) the order; set by trg_set_order_signed_by.';

-- Runs for every writer (also inside confirm_order_consumption): whenever the order's
-- signature changes or it becomes completed with a signature, record the acting user.
create or replace function public.trg_fn_set_order_signed_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and ((new.firma_url, new.firma_name, new.sello_url, new.signature_footer_text)
            is distinct from (old.firma_url, old.firma_name, old.sello_url, old.signature_footer_text)
          or (new.status = 'completada' and old.status is distinct from 'completada')) then
    new.signed_by := auth.uid();
  elsif new.signed_by is distinct from old.signed_by and public.is_api_caller() then
    new.signed_by := old.signed_by;  -- not client-writable
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_fn_set_order_signed_by() from public, anon, authenticated;

-- Name sorts after trg_guard_order_update, so it sees the signature the guard copied.
drop trigger if exists trg_set_order_signed_by on public.orders;
create trigger trg_set_order_signed_by before update on public.orders
  for each row execute function public.trg_fn_set_order_signed_by();
