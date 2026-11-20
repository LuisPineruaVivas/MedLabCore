-- ERP phase 2: financial documents, payment destinations and immutable FX history.
-- This migration is deliberately additive; laboratories without has_erp_module keep
-- their current order/billing flow unchanged.

create type public.payment_method_type as enum (
  'cash', 'bank_transfer', 'mobile_payment', 'zelle', 'pos_terminal', 'other'
);

create type public.invoice_status as enum (
  'draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled', 'credit_note'
);

create table public.exchange_rate_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  from_currency text not null default 'USD' check (char_length(from_currency) = 3),
  to_currency text not null default 'VES' check (char_length(to_currency) = 3),
  rate numeric(18,8) not null check (rate > 0),
  source text not null default 'manual',
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint exchange_rate_history_unique_per_day
    unique (org_id, from_currency, to_currency, effective_date)
);

create index idx_erh_lookup on public.exchange_rate_history
  (org_id, from_currency, to_currency, effective_date desc);

-- Preserve the current rate as the first historical snapshot when present.
insert into public.exchange_rate_history (org_id, rate, effective_date, created_at, created_by, source)
select org_id, rate, current_date, updated_at, updated_by, 'legacy:exchange_rates'
from public.exchange_rates
where rate > 0
on conflict (org_id, from_currency, to_currency, effective_date) do nothing;

create or replace function public.get_exchange_rate(
  p_org_id uuid,
  p_from text default 'USD',
  p_to text default 'VES',
  p_date date default current_date
) returns numeric
language sql stable security definer set search_path = public
as $$
  select rate
  from public.exchange_rate_history
  where org_id = p_org_id
    and from_currency = upper(p_from)
    and to_currency = upper(p_to)
    and effective_date <= p_date
  order by effective_date desc, created_at desc
  limit 1
$$;

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  method_type public.payment_method_type not null default 'cash',
  currency text not null default 'USD' check (char_length(currency) = 3),
  description text,
  bank_name text,
  account_number text,
  account_holder text,
  phone_number text,
  email text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_accounts_name_unique unique (org_id, name)
);

create index idx_bank_accounts_org on public.bank_accounts (org_id, is_active, sort_order);
create trigger trg_bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function public.handle_updated_at();

-- A row per org makes invoice sequences atomic and avoids MAX()+1 races.
create table public.invoice_sequences (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  invoice_seq integer not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  subtotal_usd numeric(12,2) not null default 0 check (subtotal_usd >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_pct numeric(5,2) not null default 0 check (tax_pct between 0 and 100),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_usd numeric(12,2) not null default 0 check (total_usd >= 0),
  exchange_rate_id uuid references public.exchange_rate_history(id) on delete set null,
  exchange_rate numeric(18,8) check (exchange_rate is null or exchange_rate > 0),
  total_local numeric(14,2) check (total_local is null or total_local >= 0),
  amount_paid_usd numeric(12,2) not null default 0 check (amount_paid_usd >= 0),
  balance_due_usd numeric(12,2) not null default 0 check (balance_due_usd >= 0),
  status public.invoice_status not null default 'issued',
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  is_exempted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint invoices_number_unique unique (org_id, invoice_number),
  constraint invoices_order_unique unique (order_id)
);

create index idx_invoices_org on public.invoices (org_id, status, issued_at desc);
create index idx_invoices_patient on public.invoices (patient_id);
create index idx_invoices_due_date on public.invoices (org_id, due_date)
  where status in ('issued', 'partial', 'overdue');
create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.handle_updated_at();

alter table public.orders add column if not exists invoice_id uuid;
alter table public.orders drop constraint if exists orders_invoice_id_fkey;
alter table public.orders add constraint orders_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete set null;
create unique index if not exists idx_orders_invoice_id on public.orders(invoice_id) where invoice_id is not null;

create or replace function public.trg_fn_set_invoice_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_seq integer;
begin
  insert into public.invoice_sequences (org_id, last_value)
  values (new.org_id, 1)
  on conflict (org_id) do update
    set last_value = public.invoice_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_seq;

  new.invoice_seq := v_seq;
  new.invoice_number := 'FAC-' || to_char(current_date, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');
  return new;
end;
$$;

create trigger trg_set_invoice_number before insert on public.invoices
  for each row execute function public.trg_fn_set_invoice_number();

-- ERP tables are tenant-isolated. Mutations are only allowed to lab admins;
-- invoices themselves are created by the order RPC below.
alter table public.exchange_rate_history enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.invoices enable row level security;
-- No policies on purpose: only the SECURITY DEFINER numbering trigger touches it.
alter table public.invoice_sequences enable row level security;
revoke all on table public.invoice_sequences from anon, authenticated;

create policy "ERP members read exchange history" on public.exchange_rate_history for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));
create policy "ERP admins manage exchange history" on public.exchange_rate_history for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')))
  with check (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')));

create policy "ERP members read bank accounts" on public.bank_accounts for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));
create policy "ERP admins manage bank accounts" on public.bank_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')))
  with check (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')));

create policy "ERP members read invoices" on public.invoices for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));
create policy "ERP admins manage invoices" on public.invoices for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')))
  with check (public.has_role(auth.uid(), 'super_admin') or (org_id = (select org_id from public.profiles where id = auth.uid()) and public.has_role(auth.uid(), 'lab_admin')));

-- The existing signature is retained so no client code has to change.
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
  v_effective_total_bs := case when coalesce(p_is_exempted, false) then 0 else p_total_bs end;
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
    values (p_org_id, '', 0, v_order.id, p_patient_id, v_effective_total_amount, v_effective_total_amount, v_rate_id, p_exchange_rate, v_effective_total_bs, 0, v_effective_total_amount, case when coalesce(p_is_exempted, false) then 'paid' else 'issued' end, coalesce(p_is_exempted, false), p_created_by)
    returning id into v_invoice_id;
    update public.orders set invoice_id = v_invoice_id where id = v_order.id;
  end if;
  return jsonb_build_object('success', true, 'orderId', v_order.id, 'invoiceId', v_invoice_id, 'access_pin', v_order.access_pin, 'order_seq', v_order.order_seq, 'userSafeMessage', 'Orden creada correctamente', 'technicalCode', 'ORDER_CREATED');
end;
$$;

grant execute on function public.get_exchange_rate(uuid, text, text, date) to authenticated;
grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) to authenticated;
