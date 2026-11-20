-- ERP hardening (phases 2-4) and cash register reconciliation.
--
-- * Every ERP RPC now checks that the organization has the module enabled and that the
--   caller belongs to that organization with an allowed role.
-- * Payments remember the method type of their destination account, so the cash closure
--   can compare the physical count only against cash (plus the opening fund).
-- * Adds payment voiding, live cash summaries, and the "reviewed" step for closed sessions.

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.erp_user_has_role(p_org_id uuid, p_roles public.user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations where id = p_org_id and has_erp_module)
    and (
      public.has_role(auth.uid(), 'super_admin')
      or exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role = any(p_roles))
    )
$$;

create or replace function public.erp_assert_access(p_org_id uuid, p_roles public.user_role[])
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_org_id is null then raise exception 'ERP_ORG_REQUIRED'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id and has_erp_module) then
    raise exception 'ERP_MODULE_DISABLED';
  end if;
  if public.has_role(auth.uid(), 'super_admin') then return; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role = any(p_roles)) then
    raise exception 'ERP_PERMISSION_DENIED';
  end if;
end;
$$;

grant execute on function public.erp_user_has_role(uuid, public.user_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- create_lab_order: fix for ERP labs
-- ---------------------------------------------------------------------------
-- The phase 2 version inserted the invoice status as an untyped CASE (text), which
-- Postgres rejects for the invoice_status enum, so every order in an ERP lab failed.
-- Also restores the original behaviour of keeping total_bs null for exempted orders
-- created without a bolivar amount.
create or replace function public.create_lab_order(
  p_org_id uuid, p_patient_id uuid, p_notes text, p_exchange_rate numeric,
  p_total_bs numeric, p_is_exempted boolean, p_items jsonb, p_created_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype; v_item jsonb; v_header_row_id uuid;
  v_total_amount numeric := 0; v_effective_total_amount numeric := 0;
  v_effective_total_bs numeric; v_profile_header_ids jsonb := '{}'::jsonb;
  v_user_role public.user_role; v_payment_status public.payment_status := 'unpaid';
  v_invoice_id uuid; v_rate_id uuid; v_erp_enabled boolean;
begin
  if p_created_by is null then raise exception 'CREATED_BY_REQUIRED'; end if;
  if auth.uid() is not null and auth.uid() <> p_created_by and not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'UNAUTHORIZED_CREATED_BY';
  end if;
  select role into v_user_role from public.profiles where id = p_created_by and org_id = p_org_id;
  if v_user_role is null then raise exception 'INVALID_CREATED_BY'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ORDER_ITEMS_REQUIRED'; end if;
  if v_user_role = 'lab_affiliate' then v_payment_status := 'pending'; end if;
  select coalesce(sum(coalesce((item->>'price')::numeric, 0)), 0) into v_total_amount from jsonb_array_elements(p_items) item;
  v_effective_total_amount := case when coalesce(p_is_exempted, false) then 0 else v_total_amount end;
  v_effective_total_bs := case
    when coalesce(p_is_exempted, false) and p_total_bs is not null then 0
    when coalesce(p_is_exempted, false) then null
    else p_total_bs
  end;
  insert into public.orders (org_id, patient_id, payment_status, total_amount, notes, exchange_rate, total_bs, is_exempted, created_by)
  values (p_org_id, p_patient_id, v_payment_status, v_effective_total_amount, nullif(trim(coalesce(p_notes, '')), ''), p_exchange_rate, v_effective_total_bs, coalesce(p_is_exempted, false), p_created_by)
  returning * into v_order;
  for v_item in select item from jsonb_array_elements(p_items) item where coalesce((item->>'isProfileHeader')::boolean, false) loop
    insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, is_profile_header)
    values (v_order.id, null, v_item->>'test_name', coalesce((v_item->>'price')::numeric, 0), null, true) returning id into v_header_row_id;
    if coalesce(v_item->>'profileId', '') <> '' then v_profile_header_ids := jsonb_set(v_profile_header_ids, array[v_item->>'profileId'], to_jsonb(v_header_row_id::text), true); end if;
  end loop;
  insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, parent_profile_id, is_profile_header)
  select v_order.id, nullif(item->>'template_id', '')::uuid, item->>'test_name', 0, coalesce(item->'schema', '{"sections":[]}'::jsonb), nullif(v_profile_header_ids ->> (item->>'parentProfileId'), '')::uuid, false
  from jsonb_array_elements(p_items) item where coalesce(item->>'parentProfileId', '') <> '';
  insert into public.order_items (order_id, template_id, test_name, price_at_order, results_data, is_profile_header)
  select v_order.id, nullif(item->>'template_id', '')::uuid, item->>'test_name', coalesce((item->>'price')::numeric, 0), coalesce(item->'schema', '{"sections":[]}'::jsonb), false
  from jsonb_array_elements(p_items) item where not coalesce((item->>'isProfileHeader')::boolean, false) and coalesce(item->>'parentProfileId', '') = '';
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

-- ---------------------------------------------------------------------------
-- Payments: method type snapshot and voiding metadata
-- ---------------------------------------------------------------------------
alter table public.payments add column if not exists method_type public.payment_method_type;
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid references auth.users(id);

update public.payments p
set method_type = b.method_type
from public.bank_accounts b
where b.id = p.bank_account_id and p.method_type is null;

update public.payments set method_type = 'other' where method_type is null;
alter table public.payments alter column method_type set default 'other';
alter table public.payments alter column method_type set not null;

create or replace function public.trg_fn_set_payment_method_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bank_account_id is not null then
    select method_type into new.method_type from public.bank_accounts where id = new.bank_account_id;
  end if;
  new.method_type := coalesce(new.method_type, 'other');
  return new;
end;
$$;

drop trigger if exists trg_set_payment_method_type on public.payments;
create trigger trg_set_payment_method_type before insert on public.payments
  for each row execute function public.trg_fn_set_payment_method_type();

create index if not exists idx_payments_cash_session on public.payments(cash_session_id) where cash_session_id is not null;

-- register_payment: same contract as phase 3, now gated by the ERP flag and org membership.
create or replace function public.register_payment(p_org_id uuid, p_invoice_id uuid, p_payments jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment jsonb; v_invoice public.invoices%rowtype; v_account public.bank_accounts%rowtype;
  v_rate numeric; v_amount numeric; v_amount_usd numeric; v_total numeric := 0; v_rate_id uuid;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'PAYMENTS_REQUIRED'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and org_id = p_org_id for update;
  if not found or v_invoice.status in ('cancelled', 'credit_note', 'paid') then raise exception 'INVOICE_NOT_PAYABLE'; end if;

  -- First pass validates everything so a bad line never leaves a partial payment behind.
  for v_payment in select value from jsonb_array_elements(p_payments) loop
    v_amount := (v_payment->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
    select * into v_account from public.bank_accounts where id = nullif(v_payment->>'bank_account_id', '')::uuid and org_id = p_org_id and is_active;
    if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
    if upper(coalesce(v_payment->>'currency', v_account.currency)) <> v_account.currency then raise exception 'ACCOUNT_CURRENCY_MISMATCH'; end if;
    if upper(v_account.currency) = 'USD' then
      v_amount_usd := v_amount;
    else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
      if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
      v_amount_usd := round(v_amount / v_rate, 2);
    end if;
    v_total := v_total + v_amount_usd;
  end loop;
  if v_total > v_invoice.balance_due_usd then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments) loop
    select * into v_account from public.bank_accounts where id = (v_payment->>'bank_account_id')::uuid;
    v_amount := (v_payment->>'amount')::numeric;
    if upper(v_account.currency) = 'USD' then
      v_rate := 1; v_amount_usd := v_amount; v_rate_id := null;
    else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
      v_amount_usd := round(v_amount / v_rate, 2);
      select id into v_rate_id from public.exchange_rate_history
      where org_id = p_org_id and from_currency = 'USD' and to_currency = v_account.currency and effective_date <= current_date
      order by effective_date desc, created_at desc limit 1;
    end if;
    insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, exchange_rate_id, exchange_rate, bank_account_id, payment_method, method_type, reference_number, created_by)
    values (p_org_id, p_invoice_id, v_amount, v_account.currency, v_amount_usd, v_rate_id, v_rate, v_account.id, v_account.name, v_account.method_type,
            nullif(trim(coalesce(v_payment->>'reference_number', '')), ''), auth.uid());
  end loop;
  return jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'total_paid_usd', v_total);
end;
$$;

-- Payments are never deleted: voiding keeps the row and the balance trigger recalculates.
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payment public.payments%rowtype; v_session_status public.cash_session_status;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_payment.org_id, array['lab_admin']::public.user_role[]);
  if v_payment.is_void then raise exception 'PAYMENT_ALREADY_VOID'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'VOID_REASON_REQUIRED'; end if;
  if v_payment.cash_session_id is not null then
    select status into v_session_status from public.cash_register_sessions where id = v_payment.cash_session_id;
    if v_session_status <> 'open' then raise exception 'CASH_SESSION_CLOSED'; end if;
  end if;
  update public.payments
  set is_void = true, void_reason = trim(p_reason), voided_at = now(), voided_by = auth.uid()
  where id = p_payment_id;
  return jsonb_build_object('success', true, 'payment_id', p_payment_id, 'invoice_id', v_payment.invoice_id);
end;
$$;

-- Balance trigger from phase 3, with the installment status CASE cast to its enum
-- (the untyped version failed on any payment to an invoice that had installments).
create or replace function public.trg_fn_update_invoice_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  v_total_paid numeric(12,2);
  v_total_usd numeric(12,2);
  v_status public.invoice_status;
  v_remaining numeric(12,2);
  v_schedule record;
  v_allocated numeric(12,2);
begin
  select coalesce(sum(amount_usd), 0) into v_total_paid from public.payments where invoice_id = v_invoice_id and not is_void;
  select total_usd into v_total_usd from public.invoices where id = v_invoice_id for update;
  if v_total_usd is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_status := case when v_total_paid >= v_total_usd then 'paid' when v_total_paid > 0 then 'partial' else 'issued' end;
  update public.invoices set amount_paid_usd = least(v_total_paid, v_total_usd), balance_due_usd = greatest(v_total_usd - v_total_paid, 0), status = v_status, paid_at = case when v_status = 'paid' then now() else null end where id = v_invoice_id and status not in ('cancelled', 'credit_note');
  update public.orders o set payment_status = case when v_status = 'paid' then 'paid'::public.payment_status when v_status = 'partial' then 'partial'::public.payment_status else 'unpaid'::public.payment_status end from public.invoices i where i.id = v_invoice_id and o.id = i.order_id;

  v_remaining := least(v_total_paid, v_total_usd);
  for v_schedule in select * from public.payment_schedules where invoice_id = v_invoice_id and status <> 'cancelled' order by installment_number loop
    v_allocated := least(v_remaining, v_schedule.amount_due_usd);
    update public.payment_schedules
    set amount_paid_usd = v_allocated,
        status = (case when v_allocated >= v_schedule.amount_due_usd then 'paid' when v_allocated > 0 then 'partial' when due_date < current_date then 'overdue' else 'pending' end)::public.schedule_status,
        paid_at = case when v_allocated >= v_schedule.amount_due_usd then coalesce(v_schedule.paid_at, now()) else null end
    where id = v_schedule.id;
    v_remaining := greatest(v_remaining - v_allocated, 0);
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Installments: org-scoped permission and correct handling of earlier payments
-- ---------------------------------------------------------------------------
-- The balance trigger allocates the invoice's total paid amount to installments in
-- order. When a plan is (re)created after some payments, those payments are recorded
-- as a settled first installment so they are not applied again to the new ones.
create or replace function public.create_payment_schedule(p_org_id uuid, p_invoice_id uuid, p_installments jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices%rowtype; v_entry jsonb; v_total numeric := 0; v_number integer := 0;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  if p_installments is null or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then raise exception 'INSTALLMENTS_REQUIRED'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and org_id = p_org_id for update;
  if not found or v_invoice.balance_due_usd <= 0 then raise exception 'INVOICE_HAS_NO_BALANCE'; end if;
  for v_entry in select value from jsonb_array_elements(p_installments) loop
    if coalesce((v_entry->>'amount_due_usd')::numeric, 0) <= 0 or nullif(v_entry->>'due_date', '') is null then raise exception 'INVALID_INSTALLMENT'; end if;
    v_total := v_total + (v_entry->>'amount_due_usd')::numeric;
  end loop;
  if round(v_total, 2) <> round(v_invoice.balance_due_usd, 2) then raise exception 'INSTALLMENTS_MUST_MATCH_BALANCE'; end if;

  delete from public.payment_schedules where invoice_id = p_invoice_id;
  if v_invoice.amount_paid_usd > 0 then
    v_number := 1;
    insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, amount_paid_usd, due_date, paid_at, status, notes)
    values (p_org_id, p_invoice_id, 1, v_invoice.amount_paid_usd, v_invoice.amount_paid_usd, current_date, now(), 'paid', 'Abonos previos al plan de cuotas');
  end if;
  for v_entry in select value from jsonb_array_elements(p_installments) loop
    v_number := v_number + 1;
    insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, due_date, notes)
    values (p_org_id, p_invoice_id, v_number, (v_entry->>'amount_due_usd')::numeric, (v_entry->>'due_date')::date, nullif(v_entry->>'notes', ''));
  end loop;
  update public.invoices
  set due_date = (select max((value->>'due_date')::date) from jsonb_array_elements(p_installments))
  where id = p_invoice_id;
  return jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'installments', v_number);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cash register: review step, live totals, corrected reconciliation
-- ---------------------------------------------------------------------------
alter table public.cash_register_sessions add column if not exists reviewed_by uuid references auth.users(id);
alter table public.cash_register_sessions add column if not exists reviewed_at timestamptz;
alter table public.cash_register_sessions add column if not exists review_notes text;
create index if not exists idx_cash_sessions_history on public.cash_register_sessions(org_id, opened_at desc);

drop policy if exists "ERP cash operators read sessions" on public.cash_register_sessions;
create policy "ERP cash operators read sessions" on public.cash_register_sessions for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));

-- Totals per currency. Only cash is physically counted: cash_expected = opening fund +
-- cash payments. Electronic methods (transfer, mobile payment, Zelle, POS) are reported
-- for information and reconciled against bank statements, not the drawer.
create or replace function public.erp_cash_session_totals(p_session_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select opening_cash_usd, opening_cash_ves from public.cash_register_sessions where id = p_session_id
  ),
  pay as (
    select currency, method_type, payment_method, sum(amount) as total, count(*) as cnt
    from public.payments
    where cash_session_id = p_session_id and not is_void
    group by currency, method_type, payment_method
  ),
  cur as (
    select 'USD'::text as currency, (select opening_cash_usd from s)::numeric as opening
    union all
    select 'VES', (select opening_cash_ves from s)::numeric
    union all
    select distinct currency, 0::numeric from pay where currency not in ('USD', 'VES')
  ),
  agg as (
    select
      cur.currency,
      coalesce(cur.opening, 0) as opening,
      coalesce((select sum(total) from pay where pay.currency = cur.currency and pay.method_type = 'cash'), 0) as cash_payments,
      coalesce((select sum(total) from pay where pay.currency = cur.currency and pay.method_type <> 'cash'), 0) as electronic,
      coalesce((select sum(cnt) from pay where pay.currency = cur.currency), 0) as cnt,
      coalesce((
        select jsonb_agg(jsonb_build_object('name', payment_method, 'method_type', method_type, 'total', total, 'count', cnt) order by total desc)
        from pay where pay.currency = cur.currency
      ), '[]'::jsonb) as by_method
    from cur
  )
  select coalesce(jsonb_object_agg(currency, jsonb_build_object(
    'opening', opening,
    'cash_payments', cash_payments,
    'cash_expected', opening + cash_payments,
    'electronic', electronic,
    'total_received', cash_payments + electronic,
    'count', cnt,
    'by_method', by_method
  )), '{}'::jsonb)
  from agg
$$;

create or replace function public.get_cash_session_summary(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org_id uuid;
begin
  select org_id into v_org_id from public.cash_register_sessions where id = p_session_id;
  if v_org_id is null then raise exception 'CASH_SESSION_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  return public.erp_cash_session_totals(p_session_id);
end;
$$;

create or replace function public.open_cash_session(p_org_id uuid, p_opening_usd numeric default 0, p_opening_ves numeric default 0, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_id uuid;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if coalesce(p_opening_usd, 0) < 0 or coalesce(p_opening_ves, 0) < 0 then raise exception 'INVALID_OPENING_AMOUNT'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  if exists (select 1 from public.cash_register_sessions where org_id = p_org_id and status = 'open') then raise exception 'CASH_SESSION_ALREADY_OPEN'; end if;
  insert into public.cash_register_sessions (org_id, opened_by, operator_name, opening_cash_usd, opening_cash_ves, notes)
  values (p_org_id, auth.uid(), coalesce(nullif(trim(v_name), ''), 'Administrador'), coalesce(p_opening_usd, 0), coalesce(p_opening_ves, 0), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return jsonb_build_object('success', true, 'session_id', v_id);
end;
$$;

-- p_actual_totals: physical cash counted per currency, e.g. {"USD": 120.5, "VES": 3400}.
create or replace function public.close_cash_session(p_session_id uuid, p_actual_totals jsonb, p_closing_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session public.cash_register_sessions%rowtype; v_expected jsonb; v_actual jsonb; v_difference jsonb;
begin
  select * into v_session from public.cash_register_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  perform public.erp_assert_access(v_session.org_id, array['lab_admin', 'secretary']::public.user_role[]);
  if p_actual_totals is not null and jsonb_typeof(p_actual_totals) <> 'object' then raise exception 'INVALID_ACTUAL_TOTALS'; end if;
  v_actual := coalesce(p_actual_totals, '{}'::jsonb);
  if exists (select 1 from jsonb_each_text(v_actual) where value::numeric < 0) then raise exception 'INVALID_ACTUAL_TOTALS'; end if;

  v_expected := public.erp_cash_session_totals(p_session_id);
  select coalesce(jsonb_object_agg(k, jsonb_build_object(
    'expected', coalesce((v_expected->k->>'cash_expected')::numeric, 0),
    'actual', coalesce((v_actual->>k)::numeric, 0),
    'difference', coalesce((v_actual->>k)::numeric, 0) - coalesce((v_expected->k->>'cash_expected')::numeric, 0)
  )), '{}'::jsonb)
  into v_difference
  from (select jsonb_object_keys(v_expected) as k union select jsonb_object_keys(v_actual)) keys;

  update public.cash_register_sessions
  set status = 'closed', closed_at = now(), closed_by = auth.uid(),
      expected_totals = v_expected, actual_totals = v_actual, difference = v_difference,
      closing_notes = nullif(trim(coalesce(p_closing_notes, '')), '')
  where id = p_session_id;
  return jsonb_build_object('success', true, 'session_id', p_session_id, 'expected', v_expected, 'difference', v_difference);
end;
$$;

create or replace function public.review_cash_session(p_session_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session public.cash_register_sessions%rowtype;
begin
  select * into v_session from public.cash_register_sessions where id = p_session_id for update;
  if not found then raise exception 'CASH_SESSION_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_session.org_id, array['lab_admin']::public.user_role[]);
  if v_session.status <> 'closed' then raise exception 'CASH_SESSION_NOT_CLOSED'; end if;
  update public.cash_register_sessions
  set status = 'reviewed', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_session_id;
  return jsonb_build_object('success', true, 'session_id', p_session_id);
end;
$$;

revoke execute on function public.erp_cash_session_totals(uuid) from public, anon, authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.get_cash_session_summary(uuid) to authenticated;
grant execute on function public.review_cash_session(uuid, text) to authenticated;
grant execute on function public.register_payment(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_payment_schedule(uuid, uuid, jsonb) to authenticated;
grant execute on function public.open_cash_session(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, jsonb, text) to authenticated;
