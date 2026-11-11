-- ERP finances, phase 2 (docs/ERP_FINANZAS_PLAN.md): accounts payable and inventory purchases
-- paid from an account.
--
-- payables: bills the lab still owes (supplier invoices, services, ...), with a due date and
-- partial payments. Paying one records an expense movement in the chosen account; its status
-- and amount_paid are recomputed from those movements (a voided payment reopens the bill).
--
-- register_purchase gains p_account_id: with an account (lab_admin only) the purchase total
-- leaves that account as an "Insumos y reactivos" expense; without one the purchase becomes a
-- payable. Initial stock loads and zero-cost entries move no money. Bioanalysts keep
-- registering purchases, which always end up as payables for the admin to pay.

create type public.payable_status as enum ('pending', 'partial', 'paid', 'cancelled');

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id),
  payee text,
  description text not null check (char_length(trim(description)) >= 2),
  reference_number text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  status public.payable_status not null default 'pending',
  due_date date,
  inventory_transaction_id uuid references public.inventory_transactions(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index idx_payables_org_status on public.payables (org_id, status, due_date);

alter table public.payables enable row level security;
revoke all on public.payables from anon;
create policy "ERP finance read payables" on public.payables for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));

alter table public.account_movements add column if not exists payable_id uuid references public.payables(id);
alter table public.account_movements add column if not exists payable_amount numeric(14,2); -- applied to the bill, in its currency
alter table public.account_movements add column if not exists inventory_transaction_id uuid references public.inventory_transactions(id);
create index if not exists idx_account_movements_payable on public.account_movements (payable_id) where payable_id is not null;

-- Recomputes a bill from its non-void payments.
create or replace function public.erp_refresh_payable(p_payable_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_paid numeric;
begin
  select coalesce(sum(payable_amount), 0) into v_paid from public.account_movements where payable_id = p_payable_id and not is_void;
  update public.payables
  set amount_paid = least(v_paid, amount),
      status = (case when cancelled_at is not null then 'cancelled' when v_paid >= amount then 'paid' when v_paid > 0 then 'partial' else 'pending' end)::public.payable_status
  where id = p_payable_id;
end;
$$;
revoke execute on function public.erp_refresh_payable(uuid) from public, anon, authenticated;

create or replace function public.trg_fn_account_movement_payable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.erp_refresh_payable(new.payable_id);
  return new;
end;
$$;
create trigger trg_account_movement_payable after insert or update of is_void on public.account_movements
  for each row when (new.payable_id is not null) execute function public.trg_fn_account_movement_payable();

-- ---------------------------------------------------------------------------
-- Payables RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_payable(
  p_org_id uuid, p_category_id uuid, p_description text, p_amount numeric, p_currency text default 'USD',
  p_due_date date default null, p_payee text default null, p_reference_number text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_MOVEMENT_AMOUNT'; end if;
  if nullif(trim(coalesce(p_description, '')), '') is null then raise exception 'PAYABLE_DESCRIPTION_REQUIRED'; end if;
  if coalesce(upper(p_currency), '') !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if not exists (select 1 from public.finance_categories where id = p_category_id and is_active and kind = 'expense' and (org_id is null or org_id = p_org_id)) then
    raise exception 'INVALID_CATEGORY';
  end if;
  insert into public.payables (org_id, category_id, payee, description, reference_number, amount, currency, due_date, created_by)
  values (p_org_id, p_category_id, nullif(trim(coalesce(p_payee, '')), ''), trim(p_description), nullif(trim(coalesce(p_reference_number, '')), ''),
          round(p_amount, 2), upper(p_currency), p_due_date, auth.uid())
  returning id into v_id;
  return jsonb_build_object('success', true, 'payable_id', v_id);
end;
$$;

-- Pays (part of) a bill from an account. p_amount is in the account's currency; p_exchange_rate
-- (local per USD) converts when the bill and the account use different currencies.
create or replace function public.pay_payable(
  p_payable_id uuid, p_account_id uuid, p_amount numeric, p_movement_date date default null,
  p_exchange_rate numeric default null, p_reference_number text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payable public.payables%rowtype; v_account public.bank_accounts%rowtype; v_usd numeric; v_rate numeric;
  v_credit numeric; v_date date := coalesce(p_movement_date, public.erp_local_date(now())); v_id uuid;
begin
  select * into v_payable from public.payables where id = p_payable_id for update;
  if not found then raise exception 'PAYABLE_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_payable.org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if v_payable.status in ('paid', 'cancelled') then raise exception 'PAYABLE_NOT_PAYABLE'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_MOVEMENT_AMOUNT'; end if;
  select * into v_account from public.bank_accounts where id = p_account_id and org_id = v_payable.org_id and is_active;
  if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
  if v_date < v_account.opening_date then raise exception 'MOVEMENT_BEFORE_OPENING'; end if;
  if v_date > public.erp_local_date(now()) then raise exception 'MOVEMENT_IN_FUTURE'; end if;

  select c.amount_usd, c.rate into v_usd, v_rate from public.erp_amount_usd(v_payable.org_id, v_account.currency, p_amount, p_exchange_rate) c;
  if v_account.currency = v_payable.currency then
    v_credit := round(p_amount, 2);
  elsif v_payable.currency = 'USD' then
    v_credit := v_usd;
  elsif v_account.currency = 'USD' then
    -- A bill in local currency paid with dollars: needs the local rate.
    v_rate := coalesce(p_exchange_rate, public.get_exchange_rate(v_payable.org_id, 'USD', v_payable.currency));
    if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
    v_credit := round(p_amount * v_rate, 2);
    v_rate := 1; -- the movement itself is in USD
  else
    raise exception 'TRANSFER_CURRENCY_UNSUPPORTED';
  end if;
  if v_credit > v_payable.amount - v_payable.amount_paid + 0.01 then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;

  insert into public.account_movements (org_id, account_id, kind, amount, currency, amount_usd, exchange_rate, category_id,
    description, reference_number, movement_date, payable_id, payable_amount, inventory_transaction_id, created_by)
  values (v_payable.org_id, v_account.id, 'expense', round(p_amount, 2), v_account.currency, v_usd, v_rate, v_payable.category_id,
    coalesce('Pago a ' || v_payable.payee || ': ', 'Pago: ') || v_payable.description,
    coalesce(nullif(trim(coalesce(p_reference_number, '')), ''), v_payable.reference_number), v_date,
    v_payable.id, least(v_credit, v_payable.amount - v_payable.amount_paid), v_payable.inventory_transaction_id, auth.uid())
  returning id into v_id;
  return jsonb_build_object('success', true, 'movement_id', v_id);
end;
$$;

-- Cancels a bill that will not be paid (admin). Payments already made stay recorded.
create or replace function public.cancel_payable(p_payable_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payable public.payables%rowtype;
begin
  select * into v_payable from public.payables where id = p_payable_id for update;
  if not found then raise exception 'PAYABLE_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_payable.org_id, array['lab_admin']::public.user_role[]);
  if v_payable.status = 'paid' then raise exception 'PAYABLE_ALREADY_PAID'; end if;
  if v_payable.status = 'cancelled' then raise exception 'PAYABLE_ALREADY_CANCELLED'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'VOID_REASON_REQUIRED'; end if;
  update public.payables set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
  where id = p_payable_id;
  return jsonb_build_object('success', true, 'payable_id', p_payable_id);
end;
$$;

-- Open totals per currency (computed in SQL, never by summing a capped PostgREST list).
create or replace function public.get_payables_summary(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object('currency', currency, 'pending', pending, 'overdue', overdue, 'count', n, 'overdue_count', overdue_n) order by currency)
    from (
      select currency, sum(amount - amount_paid) pending, count(*) n,
             coalesce(sum(amount - amount_paid) filter (where due_date < public.erp_local_date(now())), 0) overdue,
             count(*) filter (where due_date < public.erp_local_date(now())) overdue_n
      from public.payables where org_id = p_org_id and status in ('pending', 'partial')
      group by currency
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- register_purchase: pays from an account or leaves a payable
-- ---------------------------------------------------------------------------
drop function if exists public.register_purchase(uuid, uuid, numeric, numeric, text, text, text, date, text, boolean);

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
  p_is_initial boolean default false,
  p_account_id uuid default null,
  p_exchange_rate numeric default null,
  p_due_date date default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item public.items%rowtype; v_tx public.inventory_transactions%rowtype; v_account public.bank_accounts%rowtype;
  v_total numeric; v_amount numeric; v_usd numeric; v_rate numeric; v_category uuid; v_description text;
  v_supplier text := nullif(trim(coalesce(p_supplier_name, '')), ''); v_ref text := nullif(trim(coalesce(p_purchase_invoice_ref, '')), '');
  v_movement_id uuid; v_payable_id uuid;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_MOVEMENT_QUANTITY'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'INVALID_UNIT_COST'; end if;
  select * into v_item from public.items where id = p_item_id and org_id = p_org_id;
  if not found or not v_item.is_active then raise exception 'ITEM_NOT_FOUND'; end if;
  if coalesce(p_is_initial, false) and exists (select 1 from public.inventory_transactions where item_id = p_item_id) then
    raise exception 'INITIAL_STOCK_ALREADY_SET';
  end if;
  if p_account_id is not null then
    if coalesce(p_is_initial, false) then raise exception 'INITIAL_STOCK_NOT_PAID'; end if;
    -- Only admins move money; bioanalysts' purchases are left for them to pay.
    perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
    select * into v_account from public.bank_accounts where id = p_account_id and org_id = p_org_id and is_active;
    if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
    if public.erp_local_date(now()) < v_account.opening_date then raise exception 'MOVEMENT_BEFORE_OPENING'; end if;
  end if;

  insert into public.inventory_transactions (
    org_id, item_id, transaction_type, quantity, unit_cost_at_time, reference_type,
    supplier_name, purchase_invoice_ref, lot_number, expiration_date, notes, created_by
  ) values (
    p_org_id, p_item_id, (case when coalesce(p_is_initial, false) then 'initial' else 'purchase' end)::public.inventory_transaction_type,
    p_quantity, p_unit_cost, 'purchase', v_supplier, v_ref,
    nullif(trim(coalesce(p_lot_number, '')), ''), p_expiration_date, nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  ) returning * into v_tx;

  -- The latest received lot becomes the item's reference lot.
  if nullif(trim(coalesce(p_lot_number, '')), '') is not null or p_expiration_date is not null then
    update public.items
    set lot_number = coalesce(nullif(trim(coalesce(p_lot_number, '')), ''), lot_number),
        expiration_date = coalesce(p_expiration_date, expiration_date)
    where id = p_item_id;
  end if;

  -- Money side: unit costs are in USD.
  v_total := round(p_quantity * p_unit_cost, 2);
  if not coalesce(p_is_initial, false) and v_total > 0 then
    select id into v_category from public.finance_categories where org_id is null and kind = 'expense' and name = 'Insumos y reactivos';
    v_description := 'Compra: ' || rtrim(to_char(p_quantity, 'FM999999990.####'), '.') || ' × ' || v_item.name
      || coalesce(' (' || v_supplier || ')', '');
    if p_account_id is not null then
      if v_account.currency = 'USD' then
        v_amount := v_total;
      else
        v_rate := coalesce(p_exchange_rate, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
        if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
        v_amount := round(v_total * v_rate, 2);
      end if;
      select c.amount_usd, c.rate into v_usd, v_rate from public.erp_amount_usd(p_org_id, v_account.currency, v_amount, v_rate) c;
      insert into public.account_movements (org_id, account_id, kind, amount, currency, amount_usd, exchange_rate, category_id,
        description, reference_number, movement_date, inventory_transaction_id, created_by)
      values (p_org_id, v_account.id, 'expense', v_amount, v_account.currency, v_usd, v_rate, v_category,
        v_description, v_ref, public.erp_local_date(now()), v_tx.id, auth.uid())
      returning id into v_movement_id;
    else
      insert into public.payables (org_id, category_id, payee, description, reference_number, amount, currency, due_date, inventory_transaction_id, created_by)
      values (p_org_id, v_category, v_supplier, v_description, v_ref, v_total, 'USD', p_due_date, v_tx.id, auth.uid())
      returning id into v_payable_id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'transaction_id', v_tx.id, 'new_stock', v_tx.new_stock, 'new_unit_cost', v_tx.new_unit_cost,
    'movement_id', v_movement_id, 'payable_id', v_payable_id);
end;
$$;

revoke execute on function public.register_purchase(uuid, uuid, numeric, numeric, text, text, text, date, text, boolean, uuid, numeric, date) from public, anon;
revoke execute on function public.create_payable(uuid, uuid, text, numeric, text, date, text, text) from public, anon;
revoke execute on function public.pay_payable(uuid, uuid, numeric, date, numeric, text) from public, anon;
revoke execute on function public.cancel_payable(uuid, text) from public, anon;
revoke execute on function public.get_payables_summary(uuid) from public, anon;
revoke execute on function public.trg_fn_account_movement_payable() from public, anon, authenticated;
grant execute on function public.register_purchase(uuid, uuid, numeric, numeric, text, text, text, date, text, boolean, uuid, numeric, date) to authenticated;
grant execute on function public.create_payable(uuid, uuid, text, numeric, text, date, text, text) to authenticated;
grant execute on function public.pay_payable(uuid, uuid, numeric, date, numeric, text) to authenticated;
grant execute on function public.cancel_payable(uuid, text) to authenticated;
grant execute on function public.get_payables_summary(uuid) to authenticated;
