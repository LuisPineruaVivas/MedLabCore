-- Security audit run-2: rls/orders/patient_id-cross-org-reference-portal-read (medium).
--
-- Only create_lab_order checked that an order's patient belongs to the order's org. A
-- direct PATCH could point a lab-A order (whose PIN lab-A staff know) at a lab-B patient,
-- and portal_get_patient_orders then used that PIN to return the lab-B patient's
-- completed orders and results.
--
-- 1. A trigger rejects any order whose patient is in another org, on every write path.
-- 2. portal_get_patient_orders only returns orders of the same org as the order whose
--    PIN was given (defense in depth for rows written before the trigger existed).

create or replace function public.trg_fn_order_patient_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.patients where id = new.patient_id and org_id = new.org_id) then
    raise exception 'INVALID_PATIENT' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_fn_order_patient_same_org() from public, anon, authenticated;

drop trigger if exists trg_order_patient_same_org on public.orders;
create trigger trg_order_patient_same_org before insert or update of org_id, patient_id on public.orders
  for each row execute function public.trg_fn_order_patient_same_org();

-- Same body as the baseline function, plus the org binding (v_org_id).
create or replace function public.portal_get_patient_orders(p_patient_id uuid, p_pin text)
returns table(order_id uuid, created_at timestamp with time zone, status text, total_amount numeric, access_pin text,
              order_seq integer, org_name text, org_logo_url text, firma_url text, sello_url text, report_template text,
              department_order jsonb, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference_date timestamptz;
  v_org_id uuid;
begin
  select o.created_at, o.org_id into v_reference_date, v_org_id
  from public.orders o
  join public.patients pt on pt.id = o.patient_id and pt.org_id = o.org_id
  where o.patient_id = p_patient_id
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  if v_reference_date is null then return; end if;

  return query
  select o.id, o.created_at, o.status::text, o.total_amount, o.access_pin,
    o.order_seq, org.name::text, org.logo_url::text, o.firma_url::text,
    o.sello_url::text, coalesce(org.report_template::text, 'default'),
    coalesce((
      select jsonb_agg(category_settings.department_name order by category_settings.custom_sort_order, category_settings.department_name)
      from public.organization_test_category_settings category_settings
      where category_settings.org_id = o.org_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'order_id', oi.order_id, 'template_id', oi.template_id,
        'test_name', oi.test_name, 'price_at_order', oi.price_at_order,
        'results_data', oi.results_data, 'test_method_id', oi.test_method_id,
        'method_name', oi.method_name, 'created_at', oi.created_at,
        'parent_profile_id', oi.parent_profile_id, 'is_profile_header', oi.is_profile_header,
        'category', coalesce(tt.category, 'General'),
        'resolved_sort_order', coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999)
      ) order by coalesce(category_settings.custom_sort_order, 2147483647),
        coalesce(tt.category, 'General'), coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999),
        oi.created_at, oi.test_name)
      from public.order_items oi
      left join public.test_templates tt on tt.id = oi.template_id
      left join public.organization_exam_settings exam_settings on exam_settings.org_id = o.org_id and exam_settings.template_id = oi.template_id
      left join public.organization_test_category_settings category_settings on category_settings.org_id = o.org_id and category_settings.department_name = coalesce(tt.category, 'General')
      where oi.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  inner join public.organizations org on org.id = o.org_id
  where o.patient_id = p_patient_id and o.org_id = v_org_id and o.created_at <= v_reference_date
    and lower(o.status::text) = 'completada'
  order by o.created_at desc;
end;
$$;
