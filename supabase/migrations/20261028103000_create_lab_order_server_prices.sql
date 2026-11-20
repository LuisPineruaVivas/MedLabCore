-- Security audit run-2, two mediums in create_lab_order:
--   rpc/create_lab_order/client-price-and-exemption-trusted
--     Item prices, total_bs and each item's results skeleton came from the caller, so a
--     lab_affiliate could create a 0-priced order (owing nothing) with pre-filled results,
--     and a secretary could underprice orders despite the lab_admin-only price rule.
--   rpc/create_lab_order/affiliate-patient-owner-unbound
--     A lab_affiliate could create an order (and get its portal PIN) for a patient the
--     lab or another referrer registered, then read that patient's earlier results.
--
-- Now:
--   - Prices come from the server: a single exam uses the lab's own template price (the
--     lab's copy of a global template when it has one, like v_test_templates_filtered),
--     a profile header uses exam_profiles.total_price, profile children stay at 0.
--     Only a lab_admin (or super admin) may send a different price, as with item edits.
--   - results_data starts from the template's schema, never from the caller.
--   - Items must reference a template or profile of the lab (or a global template);
--     only a lab_admin may add a free item without a template.
--   - total_bs is recomputed from the server total and the exchange rate.
--   - A lab_affiliate may only order for patients it created.
-- Return shape and invoice creation are unchanged.

create or replace function public.order_template_for_org(p_org_id uuid, p_template_id uuid)
returns table(base_price numeric, schema jsonb)
language sql
stable
security definer
set search_path = public
as $$
  -- The lab's active copy of a global template wins over the global row.
  select t.base_price, t.schema
  from public.test_templates t
  where t.is_active
    and t.org_id = p_org_id
    and (t.id = p_template_id or t.id_global_ref = p_template_id)
  union all
  select g.base_price, g.schema
  from public.test_templates g
  where g.is_active
    and g.org_id is null
    and g.id = p_template_id
    and not exists (
      select 1 from public.test_templates f
      where f.org_id = p_org_id and f.id_global_ref = g.id and f.is_active
    )
  limit 1
$$;

revoke execute on function public.order_template_for_org(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_lab_order(
  p_org_id uuid, p_patient_id uuid, p_notes text, p_exchange_rate numeric, p_total_bs numeric,
  p_is_exempted boolean, p_items jsonb, p_created_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype; v_item jsonb; v_header_row_id uuid;
  v_total_amount numeric := 0; v_effective_total_amount numeric := 0;
  v_effective_total_bs numeric; v_profile_header_ids jsonb := '{}'::jsonb;
  v_user_role public.user_role; v_payment_status public.payment_status := 'unpaid';
  v_invoice_id uuid; v_rate_id uuid; v_erp_enabled boolean;
  v_can_set_price boolean;
  v_lines jsonb := '[]'::jsonb;   -- resolved items: price and schema decided here
  v_price numeric; v_schema jsonb; v_template_id uuid; v_profile_id uuid;
begin
  if p_created_by is null then raise exception 'CREATED_BY_REQUIRED'; end if;
  if auth.uid() is not null and auth.uid() <> p_created_by and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'UNAUTHORIZED_CREATED_BY';
  end if;
  select role into v_user_role from public.profiles where id = p_created_by and org_id = p_org_id;
  if v_user_role is null then raise exception 'INVALID_CREATED_BY'; end if;
  if not exists (select 1 from public.patients where id = p_patient_id and org_id = p_org_id) then
    raise exception 'INVALID_PATIENT';
  end if;
  -- Affiliates only see the patients they registered (RLS); the RPC keeps that scope.
  if v_user_role = 'lab_affiliate'
     and not exists (select 1 from public.patients where id = p_patient_id and org_id = p_org_id and created_by = p_created_by) then
    raise exception 'INVALID_PATIENT';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ORDER_ITEMS_REQUIRED'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) item where coalesce((item->>'price')::numeric, 0) < 0)
     or coalesce(p_total_bs, 0) < 0 or coalesce(p_exchange_rate, 0) < 0 then
    raise exception 'INVALID_PRICE';
  end if;
  if coalesce(p_is_exempted, false) and v_user_role = 'lab_affiliate' then raise exception 'EXEMPTION_NOT_ALLOWED'; end if;
  if v_user_role = 'lab_affiliate' then v_payment_status := 'pending'; end if;
  v_can_set_price := v_user_role = 'lab_admin' or public.has_role(auth.uid(), 'super_admin');

  -- Resolve every line's price and results skeleton on the server.
  for v_item in select item from jsonb_array_elements(p_items) item loop
    v_template_id := nullif(v_item->>'template_id', '')::uuid;
    if coalesce((v_item->>'isProfileHeader')::boolean, false) then
      v_profile_id := nullif(v_item->>'profileId', '')::uuid;
      select total_price into v_price from public.exam_profiles where id = v_profile_id and org_id = p_org_id;
      if not found then
        if not v_can_set_price then raise exception 'INVALID_TEMPLATE'; end if;
        v_price := coalesce((v_item->>'price')::numeric, 0);
      elsif v_can_set_price and v_item ? 'price' then
        v_price := (v_item->>'price')::numeric;
      end if;
      v_schema := null;
    elsif v_template_id is not null then
      select t.base_price, t.schema into v_price, v_schema from public.order_template_for_org(p_org_id, v_template_id) t;
      if not found then raise exception 'INVALID_TEMPLATE'; end if;
      if coalesce(v_item->>'parentProfileId', '') <> '' then
        v_price := 0;
      elsif v_can_set_price and v_item ? 'price' then
        v_price := (v_item->>'price')::numeric;
      end if;
      v_schema := coalesce(v_schema, '{"sections":[]}'::jsonb);
    else
      -- A free line without a template: only a lab_admin may price it.
      if not v_can_set_price then raise exception 'INVALID_TEMPLATE'; end if;
      v_price := coalesce((v_item->>'price')::numeric, 0);
      v_schema := '{"sections":[]}'::jsonb;
    end if;
    v_lines := v_lines || jsonb_build_array(v_item || jsonb_build_object('price', coalesce(v_price, 0), 'schema', v_schema));
  end loop;

  select coalesce(sum((line->>'price')::numeric), 0) into v_total_amount from jsonb_array_elements(v_lines) line;
  v_effective_total_amount := case when coalesce(p_is_exempted, false) then 0 else v_total_amount end;
  v_effective_total_bs := case
    when coalesce(p_is_exempted, false) and p_exchange_rate is not null then 0
    when coalesce(p_is_exempted, false) then null
    when p_exchange_rate is not null then round(v_effective_total_amount * p_exchange_rate, 2)
    else null
  end;
  insert into public.orders (org_id, patient_id, payment_status, total_amount, notes, exchange_rate, total_bs, is_exempted, created_by)
  values (p_org_id, p_patient_id, v_payment_status, v_effective_total_amount, nullif(trim(coalesce(p_notes, '')), ''), p_exchange_rate, v_effective_total_bs, coalesce(p_is_exempted, false), p_created_by)
  returning * into v_order;
  for v_item in select line from jsonb_array_elements(v_lines) line where coalesce((line->>'isProfileHeader')::boolean, false) loop
    insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, is_profile_header)
    values (v_order.id, null, v_item->>'test_name', (v_item->>'price')::numeric, null, true) returning id into v_header_row_id;
    if coalesce(v_item->>'profileId', '') <> '' then v_profile_header_ids := jsonb_set(v_profile_header_ids, array[v_item->>'profileId'], to_jsonb(v_header_row_id::text), true); end if;
  end loop;
  insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, parent_profile_id, is_profile_header)
  select v_order.id, nullif(line->>'template_id', '')::uuid, line->>'test_name', 0, line->'schema', nullif(v_profile_header_ids ->> (line->>'parentProfileId'), '')::uuid, false
  from jsonb_array_elements(v_lines) line where coalesce(line->>'parentProfileId', '') <> '';
  insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, is_profile_header)
  select v_order.id, nullif(line->>'template_id', '')::uuid, line->>'test_name', (line->>'price')::numeric, line->'schema', false
  from jsonb_array_elements(v_lines) line where not coalesce((line->>'isProfileHeader')::boolean, false) and coalesce(line->>'parentProfileId', '') = '';
  select has_erp_module into v_erp_enabled from public.organizations where id = p_org_id;
  if v_erp_enabled then
    select id into v_rate_id from public.exchange_rate_history where org_id = p_org_id and from_currency = 'USD' and to_currency = 'VES' and effective_date <= current_date order by effective_date desc, created_at desc limit 1;
    insert into public.invoices (org_id, invoice_number, invoice_seq, order_id, patient_id, subtotal_usd, total_usd, exchange_rate_id, exchange_rate, total_local, amount_paid_usd, balance_due_usd, status, is_exempted, created_by)
    values (p_org_id, '', 0, v_order.id, p_patient_id, v_effective_total_amount, v_effective_total_amount, v_rate_id, p_exchange_rate, v_effective_total_bs, 0, v_effective_total_amount,
            (case when coalesce(p_is_exempted, false) then 'paid' else 'issued' end)::public.invoice_status,
            coalesce(p_is_exempted, false), p_created_by)
    returning id into v_invoice_id;
    update public.orders set invoice_id = v_invoice_id where id = v_order.id;
  end if;
  return jsonb_build_object('success', true, 'orderId', v_order.id, 'invoiceId', v_invoice_id, 'access_pin', v_order.access_pin, 'order_seq', v_order.order_seq, 'userSafeMessage', 'Orden creada correctamente', 'technicalCode', 'ORDER_CREATED');
end;
$$;
