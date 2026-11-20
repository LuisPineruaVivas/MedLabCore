-- ERP finances, phase 3 (docs/ERP_FINANZAS_PLAN.md): "Por cobrar" overview.
--
-- Totals of what patients still owe, for the receivables screen (lab_admin and secretary):
-- open balances, installments overdue / due in the next 7 days / due by the end of the month,
-- and open balances with no installment plan. Computed in SQL, since summing a PostgREST
-- list is capped at 1,000 rows. Installment amounts are what is still unpaid on each one.

create or replace function public.get_receivables_overview(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public.erp_local_date(now());
  v_month_end date := (date_trunc('month', public.erp_local_date(now())) + interval '1 month - 1 day')::date;
  v_result jsonb;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin', 'secretary']::public.user_role[]);

  with open_invoices as (
    select i.id, i.balance_due_usd,
           exists (select 1 from public.payment_schedules s where s.invoice_id = i.id and s.status <> 'cancelled') as has_plan
    from public.invoices i
    where i.org_id = p_org_id and i.status in ('issued', 'partial', 'overdue') and i.balance_due_usd > 0
  ), open_installments as (
    select s.due_date, s.amount_due_usd - s.amount_paid_usd as remaining
    from public.payment_schedules s
    join open_invoices i on i.id = s.invoice_id
    where s.org_id = p_org_id and s.status in ('pending', 'partial', 'overdue') and s.amount_due_usd > s.amount_paid_usd
  )
  select jsonb_build_object(
    'as_of', v_today,
    'total_usd', coalesce((select sum(balance_due_usd) from open_invoices), 0),
    'open_invoices', (select count(*) from open_invoices),
    'unscheduled_usd', coalesce((select sum(balance_due_usd) from open_invoices where not has_plan), 0),
    'unscheduled_count', (select count(*) from open_invoices where not has_plan),
    'overdue_usd', coalesce((select sum(remaining) from open_installments where due_date < v_today), 0),
    'overdue_count', (select count(*) from open_installments where due_date < v_today),
    'due_week_usd', coalesce((select sum(remaining) from open_installments where due_date between v_today and v_today + 7), 0),
    'due_week_count', (select count(*) from open_installments where due_date between v_today and v_today + 7),
    'due_month_usd', coalesce((select sum(remaining) from open_installments where due_date between v_today and v_month_end), 0),
    'due_month_count', (select count(*) from open_installments where due_date between v_today and v_month_end)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.get_receivables_overview(uuid) from public, anon;
grant execute on function public.get_receivables_overview(uuid) to authenticated;
