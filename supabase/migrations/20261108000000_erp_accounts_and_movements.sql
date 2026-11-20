-- ERP finances, phase 1 (docs/ERP_FINANZAS_PLAN.md): accounts with a balance.
--
-- bank_accounts ("métodos de cobro") become accounts with an opening balance. Money moves
-- through an immutable ledger, account_movements (other income, expenses, transfers between
-- accounts, balance adjustments), next to the order payments already recorded in payments.
-- An account's balance is always derived: opening balance + order payments since the opening
-- date + movements. Nothing stores a balance that could drift.
--
-- Roles: lab_admin does everything; secretary records income and expenses (and still collects
-- orders) but cannot transfer, adjust, void or see balances. Cash register sessions are no
-- longer used by the app, so voiding a payment no longer depends on them.

-- ---------------------------------------------------------------------------
-- Accounts: opening balance
-- ---------------------------------------------------------------------------
alter table public.bank_accounts add column if not exists opening_balance numeric(14,2) not null default 0;
alter table public.bank_accounts add column if not exists opening_date date not null default current_date;

-- ---------------------------------------------------------------------------
-- Categories (org_id null = default shared by every lab)
-- ---------------------------------------------------------------------------
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  kind text not null check (kind in ('expense', 'income')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);
create unique index finance_categories_name_unique
  on public.finance_categories (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, lower(name));

insert into public.finance_categories (org_id, name, kind, sort_order) values
  (null, 'Servicios (luz, agua, internet, teléfono)', 'expense', 10),
  (null, 'Alquiler', 'expense', 20),
  (null, 'Nómina y pago al personal', 'expense', 30),
  (null, 'Insumos y reactivos', 'expense', 40),
  (null, 'Materiales de oficina', 'expense', 50),
  (null, 'Mantenimiento de equipos', 'expense', 60),
  (null, 'Honorarios profesionales', 'expense', 70),
  (null, 'Impuestos y tasas', 'expense', 80),
  (null, 'Transporte', 'expense', 90),
  (null, 'Publicidad', 'expense', 95),
  (null, 'Otros gastos', 'expense', 999),
  (null, 'Aporte de socios', 'income', 10),
  (null, 'Otros ingresos', 'income', 999);

alter table public.finance_categories enable row level security;
revoke all on public.finance_categories from anon;

create policy "ERP finance read categories" on public.finance_categories for select to authenticated
  using (org_id is null or public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));
create policy "ERP admins insert categories" on public.finance_categories for insert to authenticated
  with check (org_id is not null and public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]));
create policy "ERP admins update categories" on public.finance_categories for update to authenticated
  using (org_id is not null and public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]))
  with check (org_id is not null and public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[]));

-- ---------------------------------------------------------------------------
-- Movements ledger (written only by the RPCs below; voided, never deleted)
-- ---------------------------------------------------------------------------
create type public.account_movement_kind as enum
  ('income', 'expense', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out');

create table public.account_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id),
  kind public.account_movement_kind not null,
  amount numeric(14,2) not null check (amount > 0), -- in the account's currency, always positive
  currency text not null check (char_length(currency) = 3),
  amount_usd numeric(14,2) check (amount_usd is null or amount_usd >= 0),
  exchange_rate numeric(18,8) check (exchange_rate is null or exchange_rate > 0), -- local units per USD
  category_id uuid references public.finance_categories(id),
  description text,
  reference_number text,
  movement_date date not null,
  transfer_id uuid, -- both legs of a transfer share it
  is_void boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint account_movements_void_reason check (not is_void or void_reason is not null),
  constraint account_movements_usd_required check (kind not in ('income', 'expense') or amount_usd is not null)
);
create index idx_account_movements_account on public.account_movements (account_id, movement_date, created_at);
create index idx_account_movements_org_date on public.account_movements (org_id, movement_date desc);
create index idx_account_movements_transfer on public.account_movements (transfer_id) where transfer_id is not null;

alter table public.account_movements enable row level security;
revoke all on public.account_movements from anon;
-- Secretaries see income and expenses (what they record), not transfers or adjustments.
create policy "ERP finance read movements" on public.account_movements for select to authenticated
  using (
    public.erp_user_has_role(org_id, array['lab_admin']::public.user_role[])
    or (kind in ('income', 'expense') and public.erp_user_has_role(org_id, array['secretary']::public.user_role[]))
  );

create or replace function public.trg_fn_account_movements_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'ACCOUNT_MOVEMENT_IMMUTABLE'; end if;
  -- Only voiding is allowed.
  if (to_jsonb(new) - array['is_void', 'void_reason', 'voided_at', 'voided_by'])
     is distinct from (to_jsonb(old) - array['is_void', 'void_reason', 'voided_at', 'voided_by'])
     or (old.is_void and not new.is_void) then
    raise exception 'ACCOUNT_MOVEMENT_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger trg_account_movements_immutable before update or delete on public.account_movements
  for each row execute function public.trg_fn_account_movements_immutable();

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
-- Converts an amount in p_currency to USD with the caller's rate, applying the same floor as
-- register_payment for non-admins (a rate far below the lab's recent ones is refused).
create or replace function public.erp_amount_usd(p_org_id uuid, p_currency text, p_amount numeric, p_rate numeric)
returns table (amount_usd numeric, rate numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_rate numeric; v_reference numeric;
begin
  if upper(p_currency) = 'USD' then
    return query select round(p_amount, 2), 1::numeric;
    return;
  end if;
  v_rate := coalesce(p_rate, public.get_exchange_rate(p_org_id, 'USD', upper(p_currency)));
  if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
  if not public.erp_user_has_role(p_org_id, array['lab_admin']::public.user_role[]) then
    v_reference := public.erp_reference_rate(p_org_id, upper(p_currency));
    if v_reference is not null and v_rate < v_reference * 0.9 then raise exception 'EXCHANGE_RATE_OUT_OF_RANGE'; end if;
  end if;
  return query select round(p_amount / v_rate, 2), v_rate;
end;
$$;
revoke execute on function public.erp_amount_usd(uuid, text, numeric, numeric) from public, anon, authenticated;

-- Every money entry of a lab: order payments (since each account's opening date) and movements.
-- signed_amount is in the account's currency: positive in, negative out.
create or replace function public.erp_finance_entries(p_org_id uuid)
returns table (
  source text, id uuid, account_id uuid, kind text, signed_amount numeric, currency text, amount_usd numeric,
  exchange_rate numeric, entry_date date, created_at timestamptz, category_id uuid, category_name text,
  description text, reference_number text, transfer_id uuid, invoice_id uuid, order_id uuid,
  is_void boolean, void_reason text, created_by uuid
)
language sql stable security definer set search_path = public as $$
  select 'payment', p.id, p.bank_account_id, 'order_payment', p.amount, p.currency, p.amount_usd,
         p.exchange_rate, public.erp_local_date(p.payment_date), p.created_at, null::uuid, null::text,
         'Cobro orden #' || o.order_seq || ' · ' || pt.first_name || ' ' || pt.last_name,
         p.reference_number, null::uuid, p.invoice_id, i.order_id, p.is_void, p.void_reason, p.created_by
  from public.payments p
  join public.bank_accounts a on a.id = p.bank_account_id
  join public.invoices i on i.id = p.invoice_id
  join public.orders o on o.id = i.order_id
  join public.patients pt on pt.id = i.patient_id
  where p.org_id = p_org_id and public.erp_local_date(p.payment_date) >= a.opening_date
  union all
  select 'movement', m.id, m.account_id, m.kind::text,
         case when m.kind in ('income', 'transfer_in', 'adjustment_in') then m.amount else -m.amount end,
         m.currency, m.amount_usd, m.exchange_rate, m.movement_date, m.created_at, m.category_id, c.name,
         m.description, m.reference_number, m.transfer_id, null::uuid, null::uuid, m.is_void, m.void_reason, m.created_by
  from public.account_movements m
  left join public.finance_categories c on c.id = m.category_id
  where m.org_id = p_org_id
$$;
revoke execute on function public.erp_finance_entries(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Other income, expenses (admin, secretary) and balance adjustments (admin, reason required).
create or replace function public.create_account_movement(
  p_org_id uuid, p_account_id uuid, p_kind text, p_amount numeric, p_category_id uuid default null,
  p_description text default null, p_movement_date date default null, p_exchange_rate numeric default null,
  p_reference_number text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_account public.bank_accounts%rowtype; v_kind public.account_movement_kind; v_usd numeric; v_rate numeric;
  v_category public.finance_categories%rowtype; v_date date := coalesce(p_movement_date, public.erp_local_date(now()));
  v_id uuid; v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  if p_kind not in ('income', 'expense', 'adjustment_in', 'adjustment_out') then raise exception 'INVALID_MOVEMENT_KIND'; end if;
  v_kind := p_kind::public.account_movement_kind;
  perform public.erp_assert_access(p_org_id,
    case when p_kind like 'adjustment%' then array['lab_admin'] else array['lab_admin', 'secretary'] end::public.user_role[]);
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_MOVEMENT_AMOUNT'; end if;
  select * into v_account from public.bank_accounts where id = p_account_id and org_id = p_org_id and is_active;
  if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
  if v_date < v_account.opening_date then raise exception 'MOVEMENT_BEFORE_OPENING'; end if;
  if v_date > public.erp_local_date(now()) then raise exception 'MOVEMENT_IN_FUTURE'; end if;

  if p_kind in ('income', 'expense') then
    select * into v_category from public.finance_categories
    where id = p_category_id and is_active and kind = p_kind and (org_id is null or org_id = p_org_id);
    if not found then raise exception 'INVALID_CATEGORY'; end if;
  else
    if v_description is null then raise exception 'ADJUSTMENT_REASON_REQUIRED'; end if;
  end if;

  select c.amount_usd, c.rate into v_usd, v_rate from public.erp_amount_usd(p_org_id, v_account.currency, p_amount, p_exchange_rate) c;

  insert into public.account_movements (org_id, account_id, kind, amount, currency, amount_usd, exchange_rate,
    category_id, description, reference_number, movement_date, created_by)
  values (p_org_id, v_account.id, v_kind, round(p_amount, 2), v_account.currency, v_usd, v_rate,
    case when p_kind in ('income', 'expense') then p_category_id end, v_description,
    nullif(trim(coalesce(p_reference_number, '')), ''), v_date, auth.uid())
  returning id into v_id;
  return jsonb_build_object('success', true, 'movement_id', v_id);
end;
$$;

-- Moves money between two accounts of the lab (admin). With different currencies the caller
-- gives what left and what arrived; the implied rate is stored on the local-currency leg.
create or replace function public.create_account_transfer(
  p_org_id uuid, p_from_account_id uuid, p_from_amount numeric, p_to_account_id uuid, p_to_amount numeric default null,
  p_movement_date date default null, p_description text default null, p_reference_number text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_from public.bank_accounts%rowtype; v_to public.bank_accounts%rowtype; v_to_amount numeric;
  v_date date := coalesce(p_movement_date, public.erp_local_date(now())); v_transfer uuid := gen_random_uuid();
  v_from_rate numeric; v_to_rate numeric; v_usd numeric; v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  if p_from_amount is null or p_from_amount <= 0 then raise exception 'INVALID_MOVEMENT_AMOUNT'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'TRANSFER_SAME_ACCOUNT'; end if;
  select * into v_from from public.bank_accounts where id = p_from_account_id and org_id = p_org_id and is_active;
  if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
  select * into v_to from public.bank_accounts where id = p_to_account_id and org_id = p_org_id and is_active;
  if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
  if v_date < greatest(v_from.opening_date, v_to.opening_date) then raise exception 'MOVEMENT_BEFORE_OPENING'; end if;
  if v_date > public.erp_local_date(now()) then raise exception 'MOVEMENT_IN_FUTURE'; end if;

  if v_from.currency = v_to.currency then
    v_to_amount := coalesce(p_to_amount, p_from_amount);
    if v_to_amount <> p_from_amount then raise exception 'TRANSFER_AMOUNT_MISMATCH'; end if;
    if v_from.currency = 'USD' then
      v_usd := round(p_from_amount, 2); v_from_rate := 1; v_to_rate := 1;
    else
      v_from_rate := public.get_exchange_rate(p_org_id, 'USD', v_from.currency); v_to_rate := v_from_rate;
      v_usd := case when v_from_rate > 0 then round(p_from_amount / v_from_rate, 2) end;
    end if;
  else
    if p_to_amount is null or p_to_amount <= 0 then raise exception 'TRANSFER_TO_AMOUNT_REQUIRED'; end if;
    v_to_amount := p_to_amount;
    if v_from.currency = 'USD' then
      v_usd := round(p_from_amount, 2); v_from_rate := 1; v_to_rate := round(p_to_amount / p_from_amount, 8);
    elsif v_to.currency = 'USD' then
      v_usd := round(p_to_amount, 2); v_to_rate := 1; v_from_rate := round(p_from_amount / p_to_amount, 8);
    else
      raise exception 'TRANSFER_CURRENCY_UNSUPPORTED';
    end if;
  end if;

  insert into public.account_movements (org_id, account_id, kind, amount, currency, amount_usd, exchange_rate,
    description, reference_number, movement_date, transfer_id, created_by)
  values
    (p_org_id, v_from.id, 'transfer_out', round(p_from_amount, 2), v_from.currency, v_usd, v_from_rate,
     coalesce(v_description, 'Transferencia a ' || v_to.name), nullif(trim(coalesce(p_reference_number, '')), ''), v_date, v_transfer, auth.uid()),
    (p_org_id, v_to.id, 'transfer_in', round(v_to_amount, 2), v_to.currency, v_usd, v_to_rate,
     coalesce(v_description, 'Transferencia desde ' || v_from.name), nullif(trim(coalesce(p_reference_number, '')), ''), v_date, v_transfer, auth.uid());
  return jsonb_build_object('success', true, 'transfer_id', v_transfer);
end;
$$;

-- Voids a movement (admin, reason required). A transfer is voided as a whole.
create or replace function public.void_account_movement(p_movement_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_movement public.account_movements%rowtype;
begin
  select * into v_movement from public.account_movements where id = p_movement_id for update;
  if not found then raise exception 'MOVEMENT_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_movement.org_id, array['lab_admin']::public.user_role[]);
  if v_movement.is_void then raise exception 'MOVEMENT_ALREADY_VOID'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'VOID_REASON_REQUIRED'; end if;
  update public.account_movements
  set is_void = true, void_reason = trim(p_reason), voided_at = now(), voided_by = auth.uid()
  where (id = p_movement_id or (v_movement.transfer_id is not null and transfer_id = v_movement.transfer_id)) and not is_void;
  return jsonb_build_object('success', true, 'movement_id', p_movement_id);
end;
$$;

-- Balance of every account (admin): opening + non-void entries.
create or replace function public.get_account_balances(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'account_id', a.id, 'name', a.name, 'currency', a.currency, 'is_active', a.is_active,
      'opening_balance', a.opening_balance, 'opening_date', a.opening_date,
      'balance', a.opening_balance + coalesce(e.total, 0),
      'balance_usd', case when a.currency = 'USD' then a.opening_balance + coalesce(e.total, 0)
                          when r.rate > 0 then round((a.opening_balance + coalesce(e.total, 0)) / r.rate, 2) end
    ) order by a.sort_order, a.name)
    from public.bank_accounts a
    left join (
      select account_id, sum(signed_amount) total from public.erp_finance_entries(p_org_id) where not is_void group by account_id
    ) e on e.account_id = a.id
    left join lateral (select public.get_exchange_rate(p_org_id, 'USD', a.currency) rate where a.currency <> 'USD') r on true
    where a.org_id = p_org_id
  ), '[]'::jsonb);
end;
$$;

-- Movements of the lab (order payments included), newest first. Admins may filter by account
-- and get the running balance; secretaries only see income, expenses and order payments.
create or replace function public.get_finance_movements(
  p_org_id uuid, p_date_from date default null, p_date_to date default null, p_account_id uuid default null,
  p_kind text default null, p_limit integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean; v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0); v_result jsonb;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  v_is_admin := public.erp_user_has_role(p_org_id, array['lab_admin']::public.user_role[]);
  if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then raise exception 'INVALID_DATE_RANGE'; end if;

  with entries as (
    select e.*,
      -- Running balance within the account, in entry order (only meaningful when filtering by account).
      a.opening_balance + sum(case when e.is_void then 0 else e.signed_amount end)
        over (partition by e.account_id order by e.entry_date, e.created_at, e.id) as running_balance,
      a.name as account_name
    from public.erp_finance_entries(p_org_id) e
    join public.bank_accounts a on a.id = e.account_id
    where (p_account_id is null or e.account_id = p_account_id)
      and (v_is_admin or e.kind in ('income', 'expense', 'order_payment'))
  ), filtered as (
    select * from entries
    where (p_date_from is null or entry_date >= p_date_from)
      and (p_date_to is null or entry_date <= p_date_to)
      and (p_kind is null or kind = p_kind or (p_kind = 'transfer' and kind like 'transfer%') or (p_kind = 'adjustment' and kind like 'adjustment%'))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) - case when v_is_admin then array[]::text[] else array['running_balance'] end
                       order by r.entry_date desc, r.created_at desc, r.id desc)
      from (select * from filtered order by entry_date desc, created_at desc, id desc limit v_limit offset v_offset) r
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cash register sessions are retired: voiding a payment no longer checks them.
-- ---------------------------------------------------------------------------
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_payment.org_id, array['lab_admin']::public.user_role[]);
  if v_payment.is_void then raise exception 'PAYMENT_ALREADY_VOID'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'VOID_REASON_REQUIRED'; end if;
  update public.payments
  set is_void = true, void_reason = trim(p_reason), voided_at = now(), voided_by = auth.uid()
  where id = p_payment_id;
  return jsonb_build_object('success', true, 'payment_id', p_payment_id, 'invoice_id', v_payment.invoice_id);
end;
$$;

revoke execute on function public.create_account_movement(uuid, uuid, text, numeric, uuid, text, date, numeric, text) from public, anon;
revoke execute on function public.create_account_transfer(uuid, uuid, numeric, uuid, numeric, date, text, text) from public, anon;
revoke execute on function public.void_account_movement(uuid, text) from public, anon;
revoke execute on function public.get_account_balances(uuid) from public, anon;
revoke execute on function public.get_finance_movements(uuid, date, date, uuid, text, integer, integer) from public, anon;
grant execute on function public.create_account_movement(uuid, uuid, text, numeric, uuid, text, date, numeric, text) to authenticated;
grant execute on function public.create_account_transfer(uuid, uuid, numeric, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.void_account_movement(uuid, text) to authenticated;
grant execute on function public.get_account_balances(uuid) to authenticated;
grant execute on function public.get_finance_movements(uuid, date, date, uuid, text, integer, integer) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
