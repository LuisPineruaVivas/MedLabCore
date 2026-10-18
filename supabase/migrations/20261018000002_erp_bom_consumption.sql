-- ERP phase 6: recipes (BOM) per exam and confirmed supply consumption per order.
--
-- When an ERP lab approves an order, the bioanalyst reviews the supplies its exams
-- consume (pre-filled from the recipes), may adjust them, and confirm_order_consumption
-- records the consumption, discounts stock through the Kardex and completes the order
-- in a single transaction.

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.test_materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.test_templates(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity_per_test numeric(10,4) not null default 1 check (quantity_per_test > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_materials_unique unique (org_id, template_id, item_id)
);

create index idx_test_materials_template on public.test_materials(org_id, template_id);
create index idx_test_materials_item on public.test_materials(item_id);
create trigger trg_test_materials_updated_at before update on public.test_materials
  for each row execute function public.handle_updated_at();

-- RLS checks the row's org_id; this also guarantees the referenced supply is from that lab.
create or replace function public.trg_fn_test_materials_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.items where id = new.item_id and org_id = new.org_id) then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  return new;
end;
$$;

create trigger trg_test_materials_same_org before insert or update on public.test_materials
  for each row execute function public.trg_fn_test_materials_same_org();

alter table public.test_materials enable row level security;
create policy "ERP recipes read" on public.test_materials for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));
create policy "ERP recipes insert" on public.test_materials for insert to authenticated
  with check (public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]));
create policy "ERP recipes update" on public.test_materials for update to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]))
  with check (public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]));
create policy "ERP recipes delete" on public.test_materials for delete to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- Confirmed consumption
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists consumption_confirmed_at timestamptz;
alter table public.orders add column if not exists consumption_confirmed_by uuid references auth.users(id);

create table public.invoice_consumptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Nullable: orders created before the lab enabled the ERP have no invoice but still consume supplies.
  invoice_id uuid references public.invoices(id) on delete set null,
  order_id uuid not null references public.orders(id),
  item_id uuid not null references public.items(id),
  order_item_id uuid references public.order_items(id) on delete set null,
  quantity_consumed numeric(12,4) not null check (quantity_consumed > 0),
  unit_cost_at_consumption numeric(12,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  was_adjusted boolean not null default false,
  is_extra boolean not null default false,
  adjustment_reason text,
  created_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id)
);

create index idx_inv_consumptions_invoice on public.invoice_consumptions(invoice_id);
create index idx_inv_consumptions_order on public.invoice_consumptions(order_id);
create index idx_inv_consumptions_item on public.invoice_consumptions(item_id, created_at desc);

alter table public.invoice_consumptions enable row level security;
create policy "ERP consumptions read" on public.invoice_consumptions for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));

alter table public.inventory_transactions
  add constraint inventory_transactions_invoice_consumption_fkey
  foreign key (invoice_consumption_id) references public.invoice_consumptions(id);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Expected consumption of an order from its exams' recipes (one row per exam × supply).
-- Profile header rows have no template and are skipped; inactive or non-trackable
-- supplies are left out.
create or replace function public.get_order_bom_preview(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org_id uuid;
begin
  select org_id into v_org_id from public.orders where id = p_order_id;
  if v_org_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'order_item_id', oi.id,
      'test_name', oi.test_name,
      'item_id', i.id,
      'item_name', i.name,
      'item_code', i.code,
      'unit_of_measure', i.unit_of_measure,
      'quantity', tm.quantity_per_test,
      'unit_cost', i.unit_cost,
      'current_stock', i.current_stock
    ) order by oi.test_name, i.name)
    from public.order_items oi
    join public.test_materials tm on tm.template_id = oi.template_id and tm.org_id = v_org_id
    join public.items i on i.id = tm.item_id and i.is_active and i.is_trackable
    where oi.order_id = p_order_id and not coalesce(oi.is_profile_header, false)
  ), '[]'::jsonb);
end;
$$;

-- p_consumptions: [{ item_id, quantity, order_item_id?, was_adjusted?, is_extra?, reason? }]
-- p_signature: { firma_url, firma_name, sello_url, signature_footer_text } copied to the order.
create or replace function public.confirm_order_consumption(p_order_id uuid, p_consumptions jsonb, p_signature jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_invoice_id uuid;
  v_line jsonb;
  v_item public.items%rowtype;
  v_quantity numeric;
  v_order_item_id uuid;
  v_consumption_id uuid;
  v_total numeric := 0;
  v_lines integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_order.org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  if v_order.consumption_confirmed_at is not null then raise exception 'CONSUMPTION_ALREADY_CONFIRMED'; end if;
  if v_order.status in ('completada', 'cancelada') then raise exception 'ORDER_NOT_COMPLETABLE'; end if;
  if p_consumptions is not null and jsonb_typeof(p_consumptions) <> 'array' then raise exception 'INVALID_CONSUMPTIONS'; end if;

  select id into v_invoice_id from public.invoices where order_id = p_order_id;

  for v_line in select value from jsonb_array_elements(coalesce(p_consumptions, '[]'::jsonb)) loop
    v_quantity := nullif(v_line->>'quantity', '')::numeric;
    if v_quantity is null or v_quantity <= 0 then raise exception 'INVALID_MOVEMENT_QUANTITY'; end if;
    select * into v_item from public.items where id = nullif(v_line->>'item_id', '')::uuid and org_id = v_order.org_id;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
    v_order_item_id := nullif(v_line->>'order_item_id', '')::uuid;
    if v_order_item_id is not null and not exists (select 1 from public.order_items where id = v_order_item_id and order_id = p_order_id) then
      raise exception 'INVALID_ORDER_ITEM';
    end if;

    insert into public.invoice_consumptions (
      org_id, invoice_id, order_id, item_id, order_item_id, quantity_consumed,
      unit_cost_at_consumption, total_cost, was_adjusted, is_extra, adjustment_reason, confirmed_by
    ) values (
      v_order.org_id, v_invoice_id, p_order_id, v_item.id, v_order_item_id, v_quantity,
      v_item.unit_cost, round(v_quantity * v_item.unit_cost, 4),
      coalesce((v_line->>'was_adjusted')::boolean, false), coalesce((v_line->>'is_extra')::boolean, false),
      nullif(trim(coalesce(v_line->>'reason', '')), ''), auth.uid()
    ) returning id into v_consumption_id;

    -- The Kardex trigger discounts stock and raises INSUFFICIENT_STOCK, rolling back everything.
    insert into public.inventory_transactions (org_id, item_id, transaction_type, quantity, reference_type, reference_id, invoice_consumption_id, notes, created_by)
    values (v_order.org_id, v_item.id, 'consumption', -v_quantity, 'order', p_order_id, v_consumption_id,
            'Orden #' || coalesce(v_order.order_seq::text, p_order_id::text), auth.uid());

    v_total := v_total + round(v_quantity * v_item.unit_cost, 4);
    v_lines := v_lines + 1;
  end loop;

  update public.orders
  set status = 'completada',
      completed_at = now(),
      consumption_confirmed_at = now(),
      consumption_confirmed_by = auth.uid(),
      firma_url = case when p_signature ? 'firma_url' then p_signature->>'firma_url' else firma_url end,
      firma_name = case when p_signature ? 'firma_name' then p_signature->>'firma_name' else firma_name end,
      sello_url = case when p_signature ? 'sello_url' then p_signature->>'sello_url' else sello_url end,
      signature_footer_text = case when p_signature ? 'signature_footer_text' then p_signature->>'signature_footer_text' else signature_footer_text end
  where id = p_order_id;

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'lines', v_lines, 'total_cost', round(v_total, 2));
end;
$$;

grant execute on function public.get_order_bom_preview(uuid) to authenticated;
grant execute on function public.confirm_order_consumption(uuid, jsonb, jsonb) to authenticated;

comment on table public.test_materials is
  'Receta (BOM) por examen y laboratorio: insumos y cantidades que consume cada examen por defecto.';
comment on table public.invoice_consumptions is
  'Insumos efectivamente consumidos al completar una orden (receta ajustada por el bioanalista). Cada fila genera un movimiento de consumo en el Kardex.';
