-- 1. REEMPLAZO DE LA FUNCIÓN DE CREACIÓN DE ÓRDENES
drop function if exists public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb);
drop function if exists public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid);

create or replace function public.create_lab_order(
  p_org_id uuid,
  p_patient_id uuid,
  p_notes text,
  p_exchange_rate numeric,
  p_total_bs numeric,
  p_is_exempted boolean,
  p_items jsonb,
  p_created_by uuid
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
  v_effective_total_amount numeric := 0;
  v_effective_total_bs numeric := null;
  v_profile_header_ids jsonb := '{}'::jsonb;
  v_user_role public.user_role;
  v_payment_status public.payment_status := 'unpaid';
begin
  if p_created_by is null then
    raise exception 'CREATED_BY_REQUIRED';
  end if;

  select role
  into v_user_role
  from public.profiles
  where id = p_created_by;

  if v_user_role is null then
    raise exception 'INVALID_CREATED_BY';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED';
  end if;

  if v_user_role = 'lab_affiliate' then
    v_payment_status := 'pending';
  end if;

  select coalesce(sum(coalesce((item->>'price')::numeric, 0)), 0)
  into v_total_amount
  from jsonb_array_elements(p_items) item;

  v_effective_total_amount := case when coalesce(p_is_exempted, false) then 0 else v_total_amount end;
  v_effective_total_bs := case
    when coalesce(p_is_exempted, false) and p_total_bs is not null then 0
    when coalesce(p_is_exempted, false) then null
    else p_total_bs
  end;

  insert into public.orders (
    org_id,
    patient_id,
    payment_status,
    total_amount,
    notes,
    exchange_rate,
    total_bs,
    is_exempted,
    created_by
  )
  values (
    p_org_id,
    p_patient_id,
    v_payment_status,
    v_effective_total_amount,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_exchange_rate,
    v_effective_total_bs,
    coalesce(p_is_exempted, false),
    p_created_by
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

grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) to authenticated;

-- 2. ACTUALIZACIÓN DE POLÍTICAS DE SEGURIDAD (RLS)
drop policy if exists "Users can insert orders in their org" on public.orders;
drop policy if exists "Users can read orders in their org" on public.orders;
drop policy if exists "Users can update orders in their org" on public.orders;
drop policy if exists "Users can insert patients in their org" on public.patients;
drop policy if exists "Users can read patients in their org" on public.patients;
drop policy if exists "Users can update patients in their org" on public.patients;
drop policy if exists "Users can insert order_items in their org" on public.order_items;
drop policy if exists "Users can read order_items in their org" on public.order_items;
drop policy if exists "Users can update order_items in their org" on public.order_items;

create policy "Users can insert orders in their org"
on public.orders
for insert
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = orders.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and orders.created_by = auth.uid())
      )
  )
);

create policy "Users can read orders in their org"
on public.orders
for select
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = orders.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and orders.created_by = auth.uid())
      )
  )
);

create policy "Users can update orders in their org"
on public.orders
for update
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = orders.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
)
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = orders.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
);

create policy "Users can insert patients in their org"
on public.patients
for insert
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = patients.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and patients.created_by = auth.uid())
      )
  )
);

create policy "Users can read patients in their org"
on public.patients
for select
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = patients.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and patients.created_by = auth.uid())
      )
  )
);

create policy "Users can update patients in their org"
on public.patients
for update
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = patients.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
)
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = patients.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
);

create policy "Users can insert order_items in their org"
on public.order_items
for insert
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.orders o
    inner join public.profiles p on p.id = auth.uid()
    where o.id = order_items.order_id
      and p.org_id = o.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and o.created_by = auth.uid())
      )
  )
);

create policy "Users can read order_items in their org"
on public.order_items
for select
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.orders o
    inner join public.profiles p on p.id = auth.uid()
    where o.id = order_items.order_id
      and p.org_id = o.org_id
      and (
        p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
        or (p.role = 'lab_affiliate' and o.created_by = auth.uid())
      )
  )
);

create policy "Users can update order_items in their org"
on public.order_items
for update
using (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.orders o
    inner join public.profiles p on p.id = auth.uid()
    where o.id = order_items.order_id
      and p.org_id = o.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
)
with check (
  public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1
    from public.orders o
    inner join public.profiles p on p.id = auth.uid()
    where o.id = order_items.order_id
      and p.org_id = o.org_id
      and p.role = any (array['lab_admin', 'bioanalyst', 'secretary']::public.user_role[])
  )
);