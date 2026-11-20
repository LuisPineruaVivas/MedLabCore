-- ERP phase 7: report RPCs (finance, profitability, inventory, receivables aging).
--
-- Every report checks the caller's lab and role (the phase 7 draft had none, which would
-- have exposed any lab's finances). Dates are interpreted in Venezuelan local time and
-- both ends of the range are inclusive. Collected revenue (cash basis) comes from
-- payments; billed revenue from invoices; they are reported separately on purpose.

create or replace function public.erp_local_date(p_ts timestamptz)
returns date language sql immutable set search_path = public as $$
  select (p_ts at time zone 'America/Caracas')::date
$$;

create or replace function public.erp_report_range(p_date_from date, p_date_to date)
returns table (date_from date, date_to date) language sql stable set search_path = public as $$
  select
    coalesce(p_date_from, date_trunc('month', public.erp_local_date(now()))::date),
    coalesce(p_date_to, public.erp_local_date(now()))
$$;

-- Unpaid amount that is past due today for one invoice: overdue installments when it
-- has a plan, otherwise the whole balance once its due date has passed.
create or replace function public.erp_invoice_overdue_amount(p_invoice_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.payment_schedules where invoice_id = i.id) then coalesce((
      select sum(greatest(amount_due_usd - amount_paid_usd, 0)) from public.payment_schedules
      where invoice_id = i.id and status not in ('paid', 'cancelled') and due_date < public.erp_local_date(now())
    ), 0)
    when i.due_date is not null and i.due_date < public.erp_local_date(now()) then i.balance_due_usd
    else 0
  end
  from public.invoices i where i.id = p_invoice_id
$$;

-- ---------------------------------------------------------------------------
-- 7.1 Financial summary
-- ---------------------------------------------------------------------------
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
      select id, balance_due_usd from public.invoices
      where org_id = p_org_id and status in ('issued', 'partial', 'overdue') and balance_due_usd > 0
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
      'overdue_usd', coalesce((select sum(public.erp_invoice_overdue_amount(id)) from open_inv), 0),
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

-- ---------------------------------------------------------------------------
-- 7.2 Profitability
-- ---------------------------------------------------------------------------
-- Scope: orders whose consumption was confirmed in the range (only those have a real
-- cost; including the rest would inflate the margin). A billable line is a standalone
-- exam or a profile header; a profile's children add their supply cost to the header,
-- because the price lives on the header. Exempted orders bring cost but no revenue.
create or replace function public.get_erp_profitability_report(p_org_id uuid, p_date_from date default null, p_date_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  select date_from, date_to into v_from, v_to from public.erp_report_range(p_date_from, p_date_to);
  if v_to < v_from then raise exception 'INVALID_DATE_RANGE'; end if;

  return (
    with ord as (
      select id, is_exempted from public.orders
      where org_id = p_org_id and consumption_confirmed_at is not null
        and public.erp_local_date(consumption_confirmed_at) between v_from and v_to
    ),
    lines as (
      select oi.id, oi.test_name, case when ord.is_exempted then 0 else oi.price_at_order end as revenue, ord.is_exempted
      from public.order_items oi join ord on ord.id = oi.order_id
      where oi.parent_profile_id is null
    ),
    item_line as (
      select oi.id as order_item_id, coalesce(oi.parent_profile_id, oi.id) as line_id
      from public.order_items oi join ord on ord.id = oi.order_id
    ),
    cons as (
      select ic.*, il.line_id from public.invoice_consumptions ic
      join ord on ord.id = ic.order_id
      left join item_line il on il.order_item_id = ic.order_item_id
    ),
    line_cost as (
      select l.test_name, l.revenue, l.is_exempted, coalesce((select sum(total_cost) from cons where cons.line_id = l.id), 0) as cost
      from lines l
    ),
    by_test as (
      select test_name, count(*) filter (where not is_exempted) as sold, count(*) as performed,
             sum(revenue) as revenue, sum(cost) as cost
      from line_cost group by test_name
    ),
    totals as (
      select
        coalesce((select sum(revenue) from lines), 0) as revenue,
        coalesce((select sum(total_cost) from cons), 0) as cost,
        coalesce((select sum(total_cost) from cons where line_id is null), 0) as unassigned_cost,
        coalesce((select sum(cost) from line_cost where is_exempted), 0) as exempted_cost,
        (select count(*) from ord) as orders_count
    )
    select jsonb_build_object(
      'date_from', v_from,
      'date_to', v_to,
      'orders_count', t.orders_count,
      'revenue_usd', round(t.revenue, 2),
      'supply_cost_usd', round(t.cost, 2),
      'gross_profit_usd', round(t.revenue - t.cost, 2),
      'margin_pct', case when t.revenue > 0 then round((t.revenue - t.cost) / t.revenue * 100, 1) end,
      'unassigned_cost_usd', round(t.unassigned_cost, 2),
      'exempted_cost_usd', round(t.exempted_cost, 2),
      'by_test', coalesce((
        select jsonb_agg(jsonb_build_object(
          'test_name', test_name,
          'performed', performed,
          'sold', sold,
          'revenue_usd', round(revenue, 2),
          'cost_usd', round(cost, 2),
          'avg_price_usd', case when sold > 0 then round(revenue / sold, 2) end,
          'avg_cost_usd', round(cost / nullif(performed, 0), 4),
          'margin_pct', case when revenue > 0 then round((revenue - cost) / revenue * 100, 1) end
        ) order by revenue - cost desc)
        from by_test
      ), '[]'::jsonb)
    )
    from totals t
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7.3 Inventory summary
-- ---------------------------------------------------------------------------
create or replace function public.get_erp_inventory_summary(p_org_id uuid, p_date_from date default null, p_date_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; v_today date := public.erp_local_date(now());
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  select date_from, date_to into v_from, v_to from public.erp_report_range(p_date_from, p_date_to);
  if v_to < v_from then raise exception 'INVALID_DATE_RANGE'; end if;

  return (
    with it as (select * from public.items where org_id = p_org_id and is_active),
    tx as (
      select t.*, i.name as item_name, i.unit_of_measure from public.inventory_transactions t
      join public.items i on i.id = t.item_id
      where t.org_id = p_org_id and public.erp_local_date(t.transaction_date) between v_from and v_to
    )
    select jsonb_build_object(
      'date_from', v_from,
      'date_to', v_to,
      'total_value_usd', coalesce((select round(sum(total_value), 2) from it), 0),
      'active_items', (select count(*) from it),
      'low_stock', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'code', code, 'unit_of_measure', unit_of_measure, 'current_stock', current_stock, 'min_stock', min_stock) order by current_stock / nullif(min_stock, 0), name)
        from it where min_stock > 0 and current_stock <= min_stock
      ), '[]'::jsonb),
      'expiring_soon', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'lot_number', lot_number, 'expiration_date', expiration_date, 'current_stock', current_stock, 'unit_of_measure', unit_of_measure) order by expiration_date)
        from it where expiration_date is not null and current_stock > 0 and expiration_date <= v_today + 30
      ), '[]'::jsonb),
      'value_by_category', coalesce((
        select jsonb_agg(jsonb_build_object('category', category, 'value_usd', round(value, 2), 'items', cnt) order by value desc)
        from (select category, sum(total_value) as value, count(*) as cnt from it group by category) c
      ), '[]'::jsonb),
      'purchases_usd', coalesce((select round(sum(quantity * unit_cost_at_time), 2) from tx where transaction_type in ('purchase', 'initial')), 0),
      'consumption_usd', coalesce((select round(sum(-quantity * unit_cost_at_time), 2) from tx where transaction_type = 'consumption'), 0),
      'losses_usd', coalesce((select round(sum(-quantity * unit_cost_at_time), 2) from tx where transaction_type = 'adjustment_out'), 0),
      'top_consumed', coalesce((
        select jsonb_agg(row_data order by cost desc) from (
          select jsonb_build_object('item_id', item_id, 'name', item_name, 'unit_of_measure', unit_of_measure, 'quantity', sum(-quantity), 'cost_usd', round(sum(-quantity * unit_cost_at_time), 2)) as row_data,
                 sum(-quantity * unit_cost_at_time) as cost
          from tx where transaction_type = 'consumption'
          group by item_id, item_name, unit_of_measure
          order by cost desc limit 10
        ) top
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7.4 Accounts receivable aging (as of today)
-- ---------------------------------------------------------------------------
-- Age is measured from the effective due date: the earliest unpaid installment when
-- there is a plan, else the invoice due date, else the issue date.
create or replace function public.get_accounts_receivable_report(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.erp_local_date(now());
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  return (
    with open_inv as (
      select i.id, i.invoice_number, i.balance_due_usd, i.total_usd, i.issued_at, i.status,
             p.first_name || ' ' || p.last_name as patient_name, p.id_number,
             coalesce(
               (select min(due_date) from public.payment_schedules s where s.invoice_id = i.id and s.status not in ('paid', 'cancelled')),
               i.due_date,
               public.erp_local_date(i.issued_at)
             ) as effective_due
      from public.invoices i
      join public.patients p on p.id = i.patient_id
      where i.org_id = p_org_id and i.status in ('issued', 'partial', 'overdue') and i.balance_due_usd > 0
    ),
    aged as (
      select *, greatest(v_today - effective_due, 0) as days_overdue,
        case
          when effective_due >= v_today then 'current'
          when v_today - effective_due <= 30 then 'd1_30'
          when v_today - effective_due <= 60 then 'd31_60'
          when v_today - effective_due <= 90 then 'd61_90'
          else 'd90_plus'
        end as bucket
      from open_inv
    )
    select jsonb_build_object(
      'as_of', v_today,
      'total_usd', coalesce((select sum(balance_due_usd) from aged), 0),
      'buckets', jsonb_build_object(
        'current', coalesce((select sum(balance_due_usd) from aged where bucket = 'current'), 0),
        'd1_30', coalesce((select sum(balance_due_usd) from aged where bucket = 'd1_30'), 0),
        'd31_60', coalesce((select sum(balance_due_usd) from aged where bucket = 'd31_60'), 0),
        'd61_90', coalesce((select sum(balance_due_usd) from aged where bucket = 'd61_90'), 0),
        'd90_plus', coalesce((select sum(balance_due_usd) from aged where bucket = 'd90_plus'), 0)
      ),
      'invoices', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'invoice_number', invoice_number, 'patient_name', patient_name, 'id_number', id_number,
          'issued_at', issued_at, 'effective_due', effective_due, 'days_overdue', days_overdue, 'bucket', bucket,
          'total_usd', total_usd, 'balance_due_usd', balance_due_usd, 'status', status
        ) order by days_overdue desc, balance_due_usd desc)
        from aged
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.erp_invoice_overdue_amount(uuid) from public, anon, authenticated;
grant execute on function public.get_erp_financial_summary(uuid, date, date) to authenticated;
grant execute on function public.get_erp_profitability_report(uuid, date, date) to authenticated;
grant execute on function public.get_erp_inventory_summary(uuid, date, date) to authenticated;
grant execute on function public.get_accounts_receivable_report(uuid) to authenticated;
