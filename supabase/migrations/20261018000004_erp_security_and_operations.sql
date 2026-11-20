-- ERP phase 8: RLS audit fixes, report indexes, automatic overdue status and
-- retroactive invoices for orders created before the module was enabled.

-- ---------------------------------------------------------------------------
-- 8.4 RLS audit fixes
-- ---------------------------------------------------------------------------
-- invoice_sequences had no RLS: any client with the public key (even anonymous) could
-- read or rewrite another lab's invoice counter and break its order creation. Only the
-- numbering trigger (SECURITY DEFINER) writes it.
alter table public.invoice_sequences enable row level security;
revoke all on table public.invoice_sequences from anon, authenticated;

-- The exchange rate was readable for any lab, even without a session.
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
    and (
      public.has_role(auth.uid(), 'super_admin')
      or exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id)
    )
  order by effective_date desc, created_at desc
  limit 1
$$;

-- Defense in depth: ERP tables and RPCs are never needed without a session.
revoke all on table
  public.exchange_rate_history, public.bank_accounts, public.invoices, public.payments,
  public.payment_schedules, public.cash_register_sessions, public.items,
  public.inventory_transactions, public.test_materials, public.invoice_consumptions
from anon;

revoke execute on function
  public.get_exchange_rate(uuid, text, text, date),
  public.erp_user_has_role(uuid, public.user_role[]),
  public.erp_assert_access(uuid, public.user_role[]),
  public.register_payment(uuid, uuid, jsonb),
  public.void_payment(uuid, text),
  public.create_payment_schedule(uuid, uuid, jsonb),
  public.open_cash_session(uuid, numeric, numeric, text),
  public.close_cash_session(uuid, jsonb, text),
  public.get_cash_session_summary(uuid),
  public.review_cash_session(uuid, text),
  public.register_purchase(uuid, uuid, numeric, numeric, text, text, text, date, text, boolean),
  public.register_adjustment(uuid, uuid, text, numeric, text),
  public.get_order_bom_preview(uuid),
  public.confirm_order_consumption(uuid, jsonb, jsonb),
  public.get_erp_financial_summary(uuid, date, date),
  public.get_erp_profitability_report(uuid, date, date),
  public.get_erp_inventory_summary(uuid, date, date),
  public.get_accounts_receivable_report(uuid)
from public, anon;

-- ---------------------------------------------------------------------------
-- 8.5 Report indexes
-- ---------------------------------------------------------------------------
-- Reports filter by local (Caracas) date; expression indexes keep those range scans
-- on the index instead of scanning every row of the lab.
create index if not exists idx_payments_org_local_date on public.payments (org_id, public.erp_local_date(payment_date)) where not is_void;
create index if not exists idx_invoices_org_local_date on public.invoices (org_id, public.erp_local_date(issued_at));
create index if not exists idx_inv_consumptions_org_local_date on public.invoice_consumptions (org_id, public.erp_local_date(created_at));
create index if not exists idx_orders_consumption_local_date on public.orders (org_id, public.erp_local_date(consumption_confirmed_at)) where consumption_confirmed_at is not null;
create index if not exists idx_inv_tx_org_local_date on public.inventory_transactions (org_id, public.erp_local_date(transaction_date));
create index if not exists idx_invoices_open_balance on public.invoices (org_id) where status in ('issued', 'partial', 'overdue') and balance_due_usd > 0;

-- Financial summary from phase 7 with the overdue amount computed set-based: calling
-- erp_invoice_overdue_amount once per open invoice took ~160 ms with 10k open invoices.
create or replace function public.get_erp_financial_summary(p_org_id uuid, p_date_from date default null, p_date_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; v_days integer; v_today date := public.erp_local_date(now());
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  select date_from, date_to into v_from, v_to from public.erp_report_range(p_date_from, p_date_to);
  if v_to < v_from then raise exception 'INVALID_DATE_RANGE'; end if;
  v_days := v_to - v_from + 1;

  return (
    with pay as (
      select p.*, public.erp_local_date(p.payment_date) as local_date
      from public.payments p
      where p.org_id = p_org_id and not p.is_void
        and public.erp_local_date(p.payment_date) between v_from - v_days and v_to
    ),
    current_pay as (select * from pay where local_date between v_from and v_to),
    inv as (
      select * from public.invoices
      where org_id = p_org_id and status not in ('cancelled', 'credit_note')
        and public.erp_local_date(issued_at) between v_from and v_to
    ),
    open_inv as (
      select id, balance_due_usd, due_date from public.invoices
      where org_id = p_org_id and status in ('issued', 'partial', 'overdue') and balance_due_usd > 0
    ),
    overdue as (
      select
        coalesce((
          select sum(greatest(s.amount_due_usd - s.amount_paid_usd, 0))
          from public.payment_schedules s join open_inv oi on oi.id = s.invoice_id
          where s.status not in ('paid', 'cancelled') and s.due_date < v_today
        ), 0)
        + coalesce((
          select sum(oi.balance_due_usd) from open_inv oi
          where oi.due_date < v_today and not exists (select 1 from public.payment_schedules s where s.invoice_id = oi.id)
        ), 0) as amount
    )
    select jsonb_build_object(
      'date_from', v_from,
      'date_to', v_to,
      'collected_usd', coalesce((select sum(amount_usd) from current_pay), 0),
      'payments_count', (select count(*) from current_pay),
      'collected_today_usd', coalesce((select sum(amount_usd) from pay where local_date = v_today), 0),
      'previous_collected_usd', coalesce((select sum(amount_usd) from pay where local_date < v_from), 0),
      'billed_usd', coalesce((select sum(total_usd) from inv), 0),
      'invoices_count', (select count(*) from inv),
      'receivables_usd', coalesce((select sum(balance_due_usd) from open_inv), 0),
      'receivables_count', (select count(*) from open_inv),
      'overdue_usd', (select amount from overdue),
      'supply_cost_usd', coalesce((
        select sum(total_cost) from public.invoice_consumptions
        where org_id = p_org_id and public.erp_local_date(created_at) between v_from and v_to
      ), 0),
      'by_method', coalesce((
        select jsonb_agg(jsonb_build_object('name', payment_method, 'method_type', method_type, 'total_usd', total, 'count', cnt) order by total desc)
        from (select payment_method, method_type, sum(amount_usd) as total, count(*) as cnt from current_pay group by payment_method, method_type) m
      ), '[]'::jsonb),
      'by_currency', coalesce((
        select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount, 'amount_usd', amount_usd) order by amount_usd desc)
        from (select currency, sum(amount) as amount, sum(amount_usd) as amount_usd from current_pay group by currency) c
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('date', d::date, 'total_usd', coalesce(t.total, 0)) order by d)
        from generate_series(v_from, v_to, interval '1 day') d
        left join (select local_date, sum(amount_usd) as total from current_pay group by local_date) t on t.local_date = d::date
      ), '[]'::jsonb)
    )
  );
end;
$$;

create index if not exists idx_payment_schedules_invoice_open on public.payment_schedules (invoice_id) where status not in ('paid', 'cancelled');

-- Receivables aging from phase 7, paginated (8.11): buckets and totals always cover every
-- open invoice, the detailed list returns the p_limit most overdue ones (10k open
-- invoices in a single JSON took ~330 ms).
drop function if exists public.get_accounts_receivable_report(uuid);
create or replace function public.get_accounts_receivable_report(p_org_id uuid, p_limit integer default 200, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.erp_local_date(now());
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  return (
    with next_due as (
      select s.invoice_id, min(s.due_date) as due_date
      from public.payment_schedules s
      join public.invoices i on i.id = s.invoice_id and i.org_id = p_org_id
      where s.status not in ('paid', 'cancelled')
      group by s.invoice_id
    ),
    aged as (
      select i.id, i.invoice_number, i.balance_due_usd, i.total_usd, i.issued_at, i.status, i.patient_id,
             coalesce(nd.due_date, i.due_date, public.erp_local_date(i.issued_at)) as effective_due
      from public.invoices i
      left join next_due nd on nd.invoice_id = i.id
      where i.org_id = p_org_id and i.status in ('issued', 'partial', 'overdue') and i.balance_due_usd > 0
    ),
    bucketed as (
      select *, greatest(v_today - effective_due, 0) as days_overdue,
        case
          when effective_due >= v_today then 'current'
          when v_today - effective_due <= 30 then 'd1_30'
          when v_today - effective_due <= 60 then 'd31_60'
          when v_today - effective_due <= 90 then 'd61_90'
          else 'd90_plus'
        end as bucket
      from aged
    ),
    page as (
      select b.*, p.first_name || ' ' || p.last_name as patient_name, p.id_number
      from (
        select * from bucketed order by days_overdue desc, balance_due_usd desc, id
        limit greatest(coalesce(p_limit, 200), 1) offset greatest(coalesce(p_offset, 0), 0)
      ) b
      join public.patients p on p.id = b.patient_id
    )
    select jsonb_build_object(
      'as_of', v_today,
      'total_usd', coalesce((select sum(balance_due_usd) from bucketed), 0),
      'invoices_total', (select count(*) from bucketed),
      'buckets', jsonb_build_object(
        'current', coalesce((select sum(balance_due_usd) from bucketed where bucket = 'current'), 0),
        'd1_30', coalesce((select sum(balance_due_usd) from bucketed where bucket = 'd1_30'), 0),
        'd31_60', coalesce((select sum(balance_due_usd) from bucketed where bucket = 'd31_60'), 0),
        'd61_90', coalesce((select sum(balance_due_usd) from bucketed where bucket = 'd61_90'), 0),
        'd90_plus', coalesce((select sum(balance_due_usd) from bucketed where bucket = 'd90_plus'), 0)
      ),
      'invoices', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'invoice_number', invoice_number, 'patient_name', patient_name, 'id_number', id_number,
          'issued_at', issued_at, 'effective_due', effective_due, 'days_overdue', days_overdue, 'bucket', bucket,
          'total_usd', total_usd, 'balance_due_usd', balance_due_usd, 'status', status
        ) order by days_overdue desc, balance_due_usd desc, id)
        from page
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.get_accounts_receivable_report(uuid, integer, integer) from public, anon;
grant execute on function public.get_accounts_receivable_report(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8.10 Overdue status
-- ---------------------------------------------------------------------------
-- Balance trigger (phase 3, fixed in phase 4) now also marks an unpaid invoice as
-- overdue when part of it is past due, so a payment does not hide that state.
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

  if v_status <> 'paid' and public.erp_invoice_overdue_amount(v_invoice_id) > 0 then
    update public.invoices set status = 'overdue' where id = v_invoice_id and status in ('issued', 'partial');
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Daily job: invoices with a past-due balance -> overdue; unpaid installments past their date -> overdue.
create or replace function public.mark_overdue_invoices()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_schedules integer; v_invoices integer;
begin
  update public.payment_schedules s
  set status = 'overdue'
  from public.invoices i
  join public.organizations o on o.id = i.org_id and o.has_erp_module
  where s.invoice_id = i.id and s.status = 'pending' and s.amount_paid_usd = 0 and s.due_date < public.erp_local_date(now());
  get diagnostics v_schedules = row_count;

  update public.invoices i
  set status = 'overdue'
  from public.organizations o
  where o.id = i.org_id and o.has_erp_module
    and i.status in ('issued', 'partial') and i.balance_due_usd > 0
    and public.erp_invoice_overdue_amount(i.id) > 0;
  get diagnostics v_invoices = row_count;

  return jsonb_build_object('invoices', v_invoices, 'schedules', v_schedules);
end;
$$;

revoke execute on function public.mark_overdue_invoices() from public, anon, authenticated;

-- Schedule it with pg_cron when the extension is available (hosted Supabase: enable
-- "pg_cron" in Database > Extensions). 10:00 UTC = 06:00 in Caracas.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('erp-mark-overdue-invoices', '0 10 * * *', 'select public.mark_overdue_invoices()');
  else
    raise notice 'pg_cron no está disponible: programa public.mark_overdue_invoices() manualmente.';
  end if;
exception when others then
  raise notice 'No se pudo programar mark_overdue_invoices con pg_cron: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.6 Retroactive invoices
-- ---------------------------------------------------------------------------
-- Creates invoices for the lab's orders that have none (orders from before the ERP was
-- enabled). Payment detail did not exist then, so: paid orders become paid invoices,
-- everything else is issued with its full balance and a note to review it.
-- p_dry_run only counts. Idempotent: orders that already have an invoice are skipped.
create or replace function public.erp_backfill_invoices(p_org_id uuid, p_from date default null, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; v_order record; v_invoice_id uuid; v_paid boolean;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);

  if p_dry_run then
    select count(*) into v_count from public.orders o
    where o.org_id = p_org_id and o.status <> 'cancelada'
      and not exists (select 1 from public.invoices i where i.order_id = o.id)
      and (p_from is null or public.erp_local_date(o.created_at) >= p_from);
    return jsonb_build_object('success', true, 'dry_run', true, 'orders', v_count);
  end if;

  for v_order in
    select o.* from public.orders o
    where o.org_id = p_org_id and o.status <> 'cancelada'
      and not exists (select 1 from public.invoices i where i.order_id = o.id)
      and (p_from is null or public.erp_local_date(o.created_at) >= p_from)
    order by o.created_at
    for update of o
  loop
    v_paid := v_order.is_exempted or v_order.payment_status = 'paid';
    insert into public.invoices (
      org_id, invoice_number, invoice_seq, order_id, patient_id, subtotal_usd, total_usd, exchange_rate, total_local,
      amount_paid_usd, balance_due_usd, status, issued_at, paid_at, is_exempted, notes, created_by
    ) values (
      p_org_id, '', 0, v_order.id, v_order.patient_id, coalesce(v_order.total_amount, 0), coalesce(v_order.total_amount, 0),
      v_order.exchange_rate, v_order.total_bs,
      case when v_paid then coalesce(v_order.total_amount, 0) else 0 end,
      case when v_paid then 0 else coalesce(v_order.total_amount, 0) end,
      (case when v_paid then 'paid' else 'issued' end)::public.invoice_status,
      v_order.created_at, case when v_paid then v_order.created_at end, v_order.is_exempted,
      case
        when v_paid then 'Factura retroactiva: orden pagada antes de activar el módulo administrativo.'
        when v_order.payment_status = 'partial' then 'Factura retroactiva: la orden tenía un pago parcial sin detalle; registra el abono para ajustar el saldo.'
        else 'Factura retroactiva generada al activar el módulo administrativo.'
      end,
      coalesce(v_order.created_by, auth.uid())
    ) returning id into v_invoice_id;
    update public.orders set invoice_id = v_invoice_id where id = v_order.id;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'dry_run', false, 'orders', v_count);
end;
$$;

revoke execute on function public.erp_backfill_invoices(uuid, date, boolean) from public, anon;
grant execute on function public.erp_backfill_invoices(uuid, date, boolean) to authenticated;
