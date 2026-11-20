-- Security audit run-2: rls/orders+order_items/update-no-role-transition-or-column-guard (medium).
--
-- guard_order_update locked only the status of a completed order (plus the signature,
-- RPC-only and payment fields), so a secretary could move a completed, bioanalyst-signed
-- order to another patient with a direct PATCH. Once an order is completed or cancelled,
-- its subject (patient_id), tenant (org_id) and creator are now frozen for API callers.
-- The function is otherwise unchanged from 20261019000000_audit_authz_fixes.sql.

create or replace function public.guard_order_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role public.user_role;
  v_completing boolean := new.status = 'completada' and old.status is distinct from 'completada';
  v_erp boolean;
begin
  if not public.is_api_caller() or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;
  v_role := public.get_my_role();

  if old.status = 'completada' and new.status is distinct from old.status then
    raise exception 'ORDER_COMPLETED_LOCKED' using errcode = '42501';
  end if;

  -- A signed (or cancelled) order keeps its patient, tenant and creator.
  if old.status in ('completada', 'cancelada')
     and (new.patient_id, new.org_id, new.created_by) is distinct from (old.patient_id, old.org_id, old.created_by) then
    raise exception 'ORDER_COMPLETED_LOCKED' using errcode = '42501';
  end if;

  if (new.consumption_confirmed_at, new.consumption_confirmed_by, new.invoice_id)
     is distinct from (old.consumption_confirmed_at, old.consumption_confirmed_by, old.invoice_id) then
    raise exception 'ORDER_RPC_ONLY_FIELDS' using errcode = '42501';
  end if;

  if v_completing
     or (new.firma_url, new.firma_name, new.sello_url, new.signature_footer_text)
        is distinct from (old.firma_url, old.firma_name, old.sello_url, old.signature_footer_text) then
    if v_role is distinct from 'bioanalyst' then
      raise exception 'ORDER_SIGN_FORBIDDEN' using errcode = '42501';
    end if;
    if v_completing then
      select has_erp_module into v_erp from public.organizations where id = new.org_id;
      if coalesce(v_erp, false) then
        raise exception 'ORDER_COMPLETION_REQUIRES_CONSUMPTION' using errcode = '42501';
      end if;
    end if;
    select p.firma_url, p.full_name, p.sello_url, p.signature_footer_text
    into new.firma_url, new.firma_name, new.sello_url, new.signature_footer_text
    from public.profiles p where p.id = auth.uid();
  end if;

  if (new.payment_status, new.total_amount, new.total_bs, new.is_exempted)
     is distinct from (old.payment_status, old.total_amount, old.total_bs, old.is_exempted)
     and v_role is distinct from 'lab_admin' then
    raise exception 'ORDER_PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;
