create or replace function public.create_lab_order(
  p_org_id uuid,
  p_patient_id uuid,
  p_notes text,
  p_exchange_rate numeric,
  p_total_bs numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_header_row_id uuid;
  v_total_amount numeric := 0;
  v_profile_header_ids jsonb := '{}'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED';
  end if;

  select coalesce(sum(coalesce((item->>'price')::numeric, 0)), 0)
  into v_total_amount
  from jsonb_array_elements(p_items) item;

  insert into public.orders (
    org_id,
    patient_id,
    total_amount,
    notes,
    exchange_rate,
    total_bs
  )
  values (
    p_org_id,
    p_patient_id,
    v_total_amount,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_exchange_rate,
    p_total_bs
  )
  returning * into v_order;

  for v_item in
    select item
    from jsonb_array_elements(p_items) as item
    where coalesce((item->>'isProfileHeader')::boolean, false) = true
  loop
    insert into public.order_items (
      order_id,
      template_id,
      test_name,
      price_at_order,
      results_data,
      is_profile_header
    )
    values (
      v_order.id,
      null,
      v_item->>'test_name',
      coalesce((v_item->>'price')::numeric, 0),
      null,
      true
    )
    returning id into v_header_row_id;

    if coalesce(v_item->>'profileId', '') <> '' then
      v_profile_header_ids := jsonb_set(
        v_profile_header_ids,
        array[v_item->>'profileId'],
        to_jsonb(v_header_row_id::text),
        true
      );
    end if;
  end loop;

  for v_item in
    select item
    from jsonb_array_elements(p_items) as item
    where coalesce((item->>'parentProfileId')::text, '') <> ''
  loop
    insert into public.order_items (
      order_id,
      template_id,
      test_name,
      price_at_order,
      results_data,
      parent_profile_id,
      is_profile_header
    )
    values (
      v_order.id,
      nullif(v_item->>'template_id', '')::uuid,
      v_item->>'test_name',
      0,
      coalesce(v_item->'schema', '{"sections":[]}'::jsonb),
      nullif(v_profile_header_ids ->> (v_item->>'parentProfileId'), '')::uuid,
      false
    );
  end loop;

  insert into public.order_items (
    order_id,
    template_id,
    test_name,
    price_at_order,
    results_data,
    is_profile_header
  )
  select
    v_order.id,
    nullif(item->>'template_id', '')::uuid,
    item->>'test_name',
    coalesce((item->>'price')::numeric, 0),
    coalesce(item->'schema', '{"sections":[]}'::jsonb),
    false
  from jsonb_array_elements(p_items) as item
  where coalesce((item->>'isProfileHeader')::boolean, false) = false
    and coalesce((item->>'parentProfileId')::text, '') = '';

  return jsonb_build_object(
    'success', true,
    'orderId', v_order.id,
    'access_pin', v_order.access_pin,
    'order_seq', v_order.order_seq,
    'userSafeMessage', 'Orden creada correctamente',
    'technicalCode', 'ORDER_CREATED'
  );
end;
$$;

grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, jsonb) to authenticated;

create or replace function public.upsert_exam_profile(
  p_profile_id uuid,
  p_org_id uuid,
  p_name text,
  p_description text,
  p_total_price numeric,
  p_template_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile_id uuid;
begin
  if p_profile_id is null then
    insert into public.exam_profiles (
      org_id,
      name,
      description,
      total_price
    )
    values (
      p_org_id,
      p_name,
      nullif(trim(coalesce(p_description, '')), ''),
      p_total_price
    )
    returning id into v_profile_id;
  else
    update public.exam_profiles
    set
      name = p_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      total_price = p_total_price
    where id = p_profile_id
    returning id into v_profile_id;

    delete from public.profile_templates_junction
    where profile_id = v_profile_id;
  end if;

  if array_length(p_template_ids, 1) is not null then
    insert into public.profile_templates_junction (profile_id, template_id)
    select v_profile_id, unnest(p_template_ids);
  end if;

  return jsonb_build_object(
    'success', true,
    'profileId', v_profile_id,
    'userSafeMessage', 'Perfil guardado correctamente',
    'technicalCode', 'PROFILE_SAVED'
  );
end;
$$;

grant execute on function public.upsert_exam_profile(uuid, uuid, text, text, numeric, uuid[]) to authenticated;

create or replace function public.get_dashboard_summary(p_org_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  with bounds as (
    select
      date_trunc('day', now()) as today_start,
      date_trunc('day', now() - interval '1 day') as yesterday_start,
      date_trunc('month', now()) as month_start
  )
  select jsonb_build_object(
    'totalPatients', (select count(*) from public.patients p where p.org_id = p_org_id),
    'thisMonthPatients', (
      select count(*)
      from public.patients p, bounds b
      where p.org_id = p_org_id and p.created_at >= b.month_start
    ),
    'ordersToday', (
      select count(*)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.today_start
    ),
    'ordersYesterday', (
      select count(*)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.yesterday_start and o.created_at < b.today_start
    ),
    'pendingOrders', (
      select count(*)
      from public.orders o
      where o.org_id = p_org_id and o.status = 'pendiente'
    ),
    'todayRevenue', (
      select coalesce(sum(o.total_amount), 0)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.today_start
    )
  );
$$;

grant execute on function public.get_dashboard_summary(uuid) to authenticated;

create or replace function public.get_dashboard_top_tests(p_org_id uuid, p_limit integer default 5)
returns table(name text, count bigint, pct integer)
language sql
security definer
set search_path to 'public'
as $$
  with counted as (
    select oi.test_name, count(*)::bigint as usage_count
    from public.order_items oi
    inner join public.orders o on o.id = oi.order_id
    where o.org_id = p_org_id
      and oi.is_profile_header = false
    group by oi.test_name
    order by usage_count desc, oi.test_name asc
    limit p_limit
  ),
  max_count as (
    select greatest(coalesce(max(usage_count), 1), 1) as top_count
    from counted
  )
  select
    counted.test_name as name,
    counted.usage_count as count,
    round((counted.usage_count::numeric / max_count.top_count::numeric) * 100)::integer as pct
  from counted
  cross join max_count;
$$;

grant execute on function public.get_dashboard_top_tests(uuid, integer) to authenticated;
