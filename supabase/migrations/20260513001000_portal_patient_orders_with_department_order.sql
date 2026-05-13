create or replace function public.portal_get_patient_orders(
  p_patient_id uuid,
  p_pin text
) returns table(
  order_id uuid,
  created_at timestamp with time zone,
  status text,
  total_amount numeric,
  access_pin text,
  order_seq integer,
  org_name text,
  org_logo_url text,
  firma_url text,
  sello_url text,
  department_order jsonb,
  items jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reference_date timestamptz;
begin
  select o.created_at
  into v_reference_date
  from public.orders o
  where o.patient_id = p_patient_id
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  if v_reference_date is null then
    return;
  end if;

  return query
  select
    o.id as order_id,
    o.created_at,
    o.status::text,
    o.total_amount,
    o.access_pin,
    o.order_seq,
    org.name::text as org_name,
    org.logo_url::text as org_logo_url,
    o.firma_url::text,
    o.sello_url::text,
    coalesce(
      (
        select jsonb_agg(category_settings.department_name order by category_settings.custom_sort_order, category_settings.department_name)
        from public.organization_test_category_settings category_settings
        where category_settings.org_id = o.org_id
      ),
      '[]'::jsonb
    ) as department_order,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'template_id', oi.template_id,
            'test_name', oi.test_name,
            'price_at_order', oi.price_at_order,
            'results_data', oi.results_data,
            'created_at', oi.created_at,
            'parent_profile_id', oi.parent_profile_id,
            'is_profile_header', oi.is_profile_header,
            'category', coalesce(tt.category, 'General'),
            'resolved_sort_order', coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999)
          )
          order by
            coalesce(category_settings.custom_sort_order, 2147483647),
            coalesce(tt.category, 'General'),
            coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999),
            oi.created_at,
            oi.test_name
        )
        from public.order_items oi
        left join public.test_templates tt on tt.id = oi.template_id
        left join public.organization_exam_settings exam_settings
          on exam_settings.org_id = o.org_id
         and exam_settings.template_id = oi.template_id
        left join public.organization_test_category_settings category_settings
          on category_settings.org_id = o.org_id
         and category_settings.department_name = coalesce(tt.category, 'General')
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ) as items
  from public.orders o
  inner join public.organizations org on org.id = o.org_id
  where o.patient_id = p_patient_id
    and o.created_at <= v_reference_date
    and lower(o.status::text) = 'completada'
  order by o.created_at desc;
end;
$$;

grant all on function public.portal_get_patient_orders(uuid, text) to anon;
grant all on function public.portal_get_patient_orders(uuid, text) to authenticated;
grant all on function public.portal_get_patient_orders(uuid, text) to service_role;
