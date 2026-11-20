-- ERP phase 5: supply catalog, immutable Kardex and weighted average cost (WAC).
--
-- Stock and cost are never written directly: every change is an inventory_transactions
-- row, and a trigger updates items.current_stock / unit_cost / total_value from it.

create type public.item_category as enum ('reagent', 'consumable', 'equipment_part', 'office_supply', 'other');
create type public.unit_of_measure as enum ('units', 'boxes', 'packs', 'ml', 'l', 'mg', 'g', 'kg', 'tests', 'strips', 'other');
create type public.inventory_transaction_type as enum (
  'purchase', 'consumption', 'adjustment_in', 'adjustment_out', 'return', 'transfer_in', 'transfer_out', 'initial'
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null check (char_length(trim(name)) >= 2),
  description text,
  category public.item_category not null default 'consumable',
  unit_of_measure public.unit_of_measure not null default 'units',
  units_per_package numeric(10,2) not null default 1 check (units_per_package > 0),
  current_stock numeric(12,4) not null default 0,
  min_stock numeric(12,4) not null default 0 check (min_stock >= 0),
  max_stock numeric(12,4) check (max_stock is null or max_stock >= 0),
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  total_value numeric(14,4) not null default 0,
  lot_number text,
  expiration_date date,
  storage_condition text,
  is_active boolean not null default true,
  is_trackable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  constraint items_code_unique unique (org_id, code),
  constraint items_stock_non_negative check (current_stock >= 0)
);

create index idx_items_org on public.items(org_id, is_active, name);
create index idx_items_low_stock on public.items(org_id) where is_active and current_stock <= min_stock;
create trigger trg_items_updated_at before update on public.items
  for each row execute function public.handle_updated_at();

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- NO ACTION (not RESTRICT) so deleting an organization can cascade items and Kardex together.
  item_id uuid not null references public.items(id),
  transaction_type public.inventory_transaction_type not null,
  quantity numeric(12,4) not null check (quantity <> 0),  -- positive = in, negative = out
  unit_cost_at_time numeric(12,4) not null default 0 check (unit_cost_at_time >= 0),
  prev_stock numeric(12,4) not null default 0,
  new_stock numeric(12,4) not null default 0,
  prev_unit_cost numeric(12,4) not null default 0,
  new_unit_cost numeric(12,4) not null default 0,
  reference_type text,
  reference_id uuid,
  invoice_consumption_id uuid,  -- FK added in phase 6 together with invoice_consumptions
  supplier_name text,
  purchase_invoice_ref text,
  lot_number text,
  expiration_date date,
  notes text,
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create index idx_inv_tx_item on public.inventory_transactions(item_id, transaction_date desc, created_at desc);
create index idx_inv_tx_org on public.inventory_transactions(org_id, transaction_date desc);
create index idx_inv_tx_reference on public.inventory_transactions(reference_type, reference_id);
create index idx_inv_tx_type on public.inventory_transactions(org_id, transaction_type, transaction_date desc);

-- ---------------------------------------------------------------------------
-- Stock columns are owned by the Kardex trigger
-- ---------------------------------------------------------------------------
create or replace function public.trg_fn_protect_item_stock()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('erp.inventory_sync', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- New items always start empty; opening stock is loaded as an 'initial' movement.
    new.current_stock := 0;
    new.unit_cost := 0;
    new.total_value := 0;
  elsif new.current_stock is distinct from old.current_stock
     or new.unit_cost is distinct from old.unit_cost
     or new.total_value is distinct from old.total_value
     or new.org_id is distinct from old.org_id then
    raise exception 'ITEM_STOCK_READ_ONLY';
  end if;
  return new;
end;
$$;

create trigger trg_protect_item_stock before insert or update on public.items
  for each row execute function public.trg_fn_protect_item_stock();

create or replace function public.trg_fn_update_item_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item public.items%rowtype;
  v_new_stock numeric(12,4);
  v_new_cost numeric(12,4);
begin
  select * into v_item from public.items where id = new.item_id for update;
  if not found or v_item.org_id <> new.org_id then raise exception 'ITEM_NOT_FOUND'; end if;

  if new.transaction_type in ('purchase', 'adjustment_in', 'return', 'transfer_in', 'initial') and new.quantity <= 0 then
    raise exception 'INVALID_MOVEMENT_QUANTITY';
  end if;
  if new.transaction_type in ('consumption', 'adjustment_out', 'transfer_out') and new.quantity >= 0 then
    raise exception 'INVALID_MOVEMENT_QUANTITY';
  end if;

  new.prev_stock := v_item.current_stock;
  new.prev_unit_cost := v_item.unit_cost;
  v_new_stock := v_item.current_stock + new.quantity;

  if v_new_stock < 0 then
    raise exception 'INSUFFICIENT_STOCK: % (stock %, solicitado %)', v_item.name, v_item.current_stock, abs(new.quantity);
  end if;

  if new.transaction_type in ('purchase', 'return', 'transfer_in', 'initial') then
    -- WAC = (stock x current cost + quantity x new cost) / (stock + quantity)
    v_new_cost := round(((v_item.current_stock * v_item.unit_cost) + (new.quantity * new.unit_cost_at_time)) / v_new_stock, 4);
  else
    -- Outflows and positive adjustments are valued at the current WAC and leave it unchanged.
    v_new_cost := v_item.unit_cost;
    new.unit_cost_at_time := v_item.unit_cost;
  end if;

  new.new_stock := v_new_stock;
  new.new_unit_cost := v_new_cost;

  perform set_config('erp.inventory_sync', 'on', true);
  update public.items
  set current_stock = v_new_stock,
      unit_cost = v_new_cost,
      total_value = round(v_new_stock * v_new_cost, 4)
  where id = new.item_id;
  perform set_config('erp.inventory_sync', 'off', true);

  return new;
end;
$$;

create trigger trg_update_item_stock before insert on public.inventory_transactions
  for each row execute function public.trg_fn_update_item_stock();

create or replace function public.trg_fn_inventory_transactions_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'INVENTORY_TRANSACTIONS_IMMUTABLE';
end;
$$;

create trigger trg_inventory_transactions_immutable before update on public.inventory_transactions
  for each row execute function public.trg_fn_inventory_transactions_immutable();

-- ---------------------------------------------------------------------------
-- RLS: catalog editable by admins and bioanalysts; the Kardex is written only by RPCs
-- and has no update/delete policies.
-- ---------------------------------------------------------------------------
alter table public.items enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "ERP inventory read items" on public.items for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));
create policy "ERP inventory insert items" on public.items for insert to authenticated
  with check (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));
create policy "ERP inventory update items" on public.items for update to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]))
  with check (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));

create policy "ERP inventory read kardex" on public.inventory_transactions for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'bioanalyst']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Purchase entry (or the opening stock when p_is_initial). Recalculates WAC.
create or replace function public.register_purchase(
  p_org_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_supplier_name text default null,
  p_purchase_invoice_ref text default null,
  p_lot_number text default null,
  p_expiration_date date default null,
  p_notes text default null,
  p_is_initial boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item public.items%rowtype; v_tx public.inventory_transactions%rowtype;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_MOVEMENT_QUANTITY'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'INVALID_UNIT_COST'; end if;
  select * into v_item from public.items where id = p_item_id and org_id = p_org_id;
  if not found or not v_item.is_active then raise exception 'ITEM_NOT_FOUND'; end if;
  if coalesce(p_is_initial, false) and exists (select 1 from public.inventory_transactions where item_id = p_item_id) then
    raise exception 'INITIAL_STOCK_ALREADY_SET';
  end if;

  insert into public.inventory_transactions (
    org_id, item_id, transaction_type, quantity, unit_cost_at_time, reference_type,
    supplier_name, purchase_invoice_ref, lot_number, expiration_date, notes, created_by
  ) values (
    p_org_id, p_item_id, (case when coalesce(p_is_initial, false) then 'initial' else 'purchase' end)::public.inventory_transaction_type,
    p_quantity, p_unit_cost, 'purchase',
    nullif(trim(coalesce(p_supplier_name, '')), ''), nullif(trim(coalesce(p_purchase_invoice_ref, '')), ''),
    nullif(trim(coalesce(p_lot_number, '')), ''), p_expiration_date, nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  ) returning * into v_tx;

  -- The latest received lot becomes the item's reference lot.
  if nullif(trim(coalesce(p_lot_number, '')), '') is not null or p_expiration_date is not null then
    update public.items
    set lot_number = coalesce(nullif(trim(coalesce(p_lot_number, '')), ''), lot_number),
        expiration_date = coalesce(p_expiration_date, expiration_date)
    where id = p_item_id;
  end if;

  return jsonb_build_object('success', true, 'transaction_id', v_tx.id, 'new_stock', v_tx.new_stock, 'new_unit_cost', v_tx.new_unit_cost);
end;
$$;

-- Physical count corrections, losses, breakage or expirations. A reason is mandatory.
create or replace function public.register_adjustment(
  p_org_id uuid,
  p_item_id uuid,
  p_direction text,
  p_quantity numeric,
  p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item public.items%rowtype; v_tx public.inventory_transactions%rowtype;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  if p_direction not in ('in', 'out') then raise exception 'INVALID_ADJUSTMENT_DIRECTION'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_MOVEMENT_QUANTITY'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'ADJUSTMENT_REASON_REQUIRED'; end if;
  select * into v_item from public.items where id = p_item_id and org_id = p_org_id;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;

  insert into public.inventory_transactions (org_id, item_id, transaction_type, quantity, reference_type, notes, created_by)
  values (
    p_org_id, p_item_id,
    case when p_direction = 'in' then 'adjustment_in' else 'adjustment_out' end::public.inventory_transaction_type,
    case when p_direction = 'in' then p_quantity else -p_quantity end,
    'adjustment', trim(p_reason), auth.uid()
  ) returning * into v_tx;

  return jsonb_build_object('success', true, 'transaction_id', v_tx.id, 'new_stock', v_tx.new_stock, 'new_unit_cost', v_tx.new_unit_cost);
end;
$$;

grant execute on function public.register_purchase(uuid, uuid, numeric, numeric, text, text, text, date, text, boolean) to authenticated;
grant execute on function public.register_adjustment(uuid, uuid, text, numeric, text) to authenticated;

comment on table public.items is
  'Catálogo de insumos del laboratorio. current_stock, unit_cost (WAC) y total_value sólo cambian vía inventory_transactions.';
comment on table public.inventory_transactions is
  'Kardex inmutable: cada movimiento de inventario con stock y costo antes/después. Sin UPDATE ni DELETE.';
