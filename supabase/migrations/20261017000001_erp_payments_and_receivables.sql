-- ERP phase 3: immutable payment ledger, balance synchronization and installments.

create type public.schedule_status as enum ('pending', 'partial', 'paid', 'overdue', 'cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  exchange_rate_id uuid references public.exchange_rate_history(id) on delete set null,
  exchange_rate numeric(18,8) check (exchange_rate is null or exchange_rate > 0),
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  payment_method text not null,
  reference_number text,
  receipt_url text,
  cash_session_id uuid,
  is_void boolean not null default false,
  void_reason text,
  payment_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint payments_void_reason_required check (not is_void or void_reason is not null)
);
create index idx_payments_invoice on public.payments(invoice_id, payment_date desc);
create index idx_payments_org on public.payments(org_id, payment_date desc);
create index idx_payments_bank_account on public.payments(bank_account_id, payment_date desc);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount_due_usd numeric(12,2) not null check (amount_due_usd > 0),
  amount_paid_usd numeric(12,2) not null default 0 check (amount_paid_usd >= 0),
  due_date date not null,
  paid_at timestamptz,
  status public.schedule_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_schedules_unique_installment unique (invoice_id, installment_number)
);
create index idx_payment_schedules_invoice on public.payment_schedules(invoice_id, installment_number);
create index idx_payment_schedules_overdue on public.payment_schedules(org_id, due_date, status)
  where status in ('pending', 'partial');
create trigger trg_payment_schedules_updated_at before update on public.payment_schedules
  for each row execute function public.handle_updated_at();

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

  -- Apply the paid amount sequentially to installments; recalculating makes voids safe.
  v_remaining := least(v_total_paid, v_total_usd);
  for v_schedule in select * from public.payment_schedules where invoice_id = v_invoice_id order by installment_number loop
    v_allocated := least(v_remaining, v_schedule.amount_due_usd);
    update public.payment_schedules set amount_paid_usd = v_allocated, status = case when v_allocated >= v_schedule.amount_due_usd then 'paid' when v_allocated > 0 then 'partial' when due_date < current_date then 'overdue' else 'pending' end, paid_at = case when v_allocated >= v_schedule.amount_due_usd then now() else null end where id = v_schedule.id;
    v_remaining := greatest(v_remaining - v_allocated, 0);
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger trg_update_invoice_balance after insert or update or delete on public.payments
  for each row execute function public.trg_fn_update_invoice_balance();

alter table public.payments enable row level security;
alter table public.payment_schedules enable row level security;
create policy "ERP members read payments" on public.payments for select to authenticated using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));
create policy "ERP members read schedules" on public.payment_schedules for select to authenticated using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));
create policy "ERP admins manage schedules" on public.payment_schedules for all to authenticated using (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin'))) with check (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')));

create or replace function public.register_payment(p_org_id uuid, p_invoice_id uuid, p_payments jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment jsonb; v_invoice public.invoices%rowtype; v_account public.bank_accounts%rowtype;
  v_rate numeric; v_amount numeric; v_amount_usd numeric; v_total numeric := 0; v_rate_id uuid; v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid() and org_id = p_org_id;
  if not public.has_role(auth.uid(), 'super_admin') and coalesce(v_role in ('lab_admin', 'secretary'), false) = false then raise exception 'ERP_PAYMENT_PERMISSION_DENIED'; end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'PAYMENTS_REQUIRED'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and org_id = p_org_id for update;
  if not found or v_invoice.status in ('cancelled', 'credit_note', 'paid') then raise exception 'INVOICE_NOT_PAYABLE'; end if;
  for v_payment in select value from jsonb_array_elements(p_payments) loop
    v_amount := (v_payment->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
    select * into v_account from public.bank_accounts where id = nullif(v_payment->>'bank_account_id', '')::uuid and org_id = p_org_id and is_active;
    if not found then raise exception 'INVALID_BANK_ACCOUNT'; end if;
    if upper(coalesce(v_payment->>'currency', v_account.currency)) <> v_account.currency then raise exception 'ACCOUNT_CURRENCY_MISMATCH'; end if;
    if upper(v_account.currency) = 'USD' then v_rate := 1; v_amount_usd := v_amount; v_rate_id := null; else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency));
      if v_rate is null or v_rate <= 0 then raise exception 'EXCHANGE_RATE_REQUIRED'; end if;
      v_amount_usd := round(v_amount / v_rate, 2);
      select id into v_rate_id from public.exchange_rate_history where org_id = p_org_id and from_currency = 'USD' and to_currency = v_account.currency and effective_date <= current_date order by effective_date desc, created_at desc limit 1;
    end if;
    v_total := v_total + v_amount_usd;
  end loop;
  if v_total > v_invoice.balance_due_usd then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
  for v_payment in select value from jsonb_array_elements(p_payments) loop
    select * into v_account from public.bank_accounts where id = (v_payment->>'bank_account_id')::uuid;
    v_amount := (v_payment->>'amount')::numeric;
    if upper(v_account.currency) = 'USD' then v_rate := 1; v_amount_usd := v_amount; v_rate_id := null; else
      v_rate := coalesce(nullif(v_payment->>'exchange_rate', '')::numeric, public.get_exchange_rate(p_org_id, 'USD', v_account.currency)); v_amount_usd := round(v_amount / v_rate, 2);
      select id into v_rate_id from public.exchange_rate_history where org_id = p_org_id and from_currency = 'USD' and to_currency = v_account.currency and effective_date <= current_date order by effective_date desc, created_at desc limit 1;
    end if;
    insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, exchange_rate_id, exchange_rate, bank_account_id, payment_method, reference_number, created_by)
    values (p_org_id, p_invoice_id, v_amount, v_account.currency, v_amount_usd, v_rate_id, v_rate, v_account.id, v_account.name, nullif(trim(coalesce(v_payment->>'reference_number', '')), ''), auth.uid());
  end loop;
  return jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'total_paid_usd', v_total);
end;
$$;

create or replace function public.create_payment_schedule(p_org_id uuid, p_invoice_id uuid, p_installments jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices%rowtype; v_entry jsonb; v_total numeric := 0; v_number integer := 0;
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'lab_admin')) then raise exception 'ERP_SCHEDULE_PERMISSION_DENIED'; end if;
  if p_installments is null or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then raise exception 'INSTALLMENTS_REQUIRED'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id and org_id = p_org_id for update;
  if not found or v_invoice.balance_due_usd <= 0 then raise exception 'INVOICE_HAS_NO_BALANCE'; end if;
  for v_entry in select value from jsonb_array_elements(p_installments) loop
    if coalesce((v_entry->>'amount_due_usd')::numeric, 0) <= 0 or nullif(v_entry->>'due_date', '') is null then raise exception 'INVALID_INSTALLMENT'; end if;
    v_total := v_total + (v_entry->>'amount_due_usd')::numeric;
  end loop;
  if round(v_total, 2) <> round(v_invoice.balance_due_usd, 2) then raise exception 'INSTALLMENTS_MUST_MATCH_BALANCE'; end if;
  delete from public.payment_schedules where invoice_id = p_invoice_id and amount_paid_usd = 0;
  for v_entry in select value from jsonb_array_elements(p_installments) loop
    v_number := v_number + 1;
    insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, due_date, notes)
    values (p_org_id, p_invoice_id, v_number, (v_entry->>'amount_due_usd')::numeric, (v_entry->>'due_date')::date, nullif(v_entry->>'notes', ''));
  end loop;
  return jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'installments', v_number);
end;
$$;

grant execute on function public.register_payment(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_payment_schedule(uuid, uuid, jsonb) to authenticated;
