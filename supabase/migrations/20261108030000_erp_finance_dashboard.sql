-- ERP finances, phase 4 (docs/ERP_FINANZAS_PLAN.md): figures for the financial dashboard.
--
-- Cash basis, in USD: income = order payments + other income; expenses = expense movements
-- (including inventory purchases paid and bills paid). Transfers and balance adjustments move
-- money between or within accounts and are neither income nor expense. Voided entries do not
-- count. Admins only (secretaries do not see the profit).

create or replace function public.get_finance_dashboard(p_org_id uuid, p_date_from date default null, p_date_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_to date := coalesce(p_date_to, public.erp_local_date(now()));
  v_from date := coalesce(p_date_from, date_trunc('month', coalesce(p_date_to, public.erp_local_date(now())))::date);
  v_series_from date := (date_trunc('month', coalesce(p_date_to, public.erp_local_date(now()))) - interval '5 months')::date;
  v_result jsonb;
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
  if v_from > v_to then raise exception 'INVALID_DATE_RANGE'; end if;

  with entries as (
    select public.erp_local_date(p.payment_date) as d, 'order_income'::text as kind, p.amount_usd as usd, null::uuid as category_id
    from public.payments p
    where p.org_id = p_org_id and not p.is_void
      and public.erp_local_date(p.payment_date) between least(v_from, v_series_from) and v_to
    union all
    select m.movement_date, case when m.kind = 'income' then 'other_income' else 'expense' end, coalesce(m.amount_usd, 0), m.category_id
    from public.account_movements m
    where m.org_id = p_org_id and not m.is_void and m.kind in ('income', 'expense')
      and m.movement_date between least(v_from, v_series_from) and v_to
  ), period as (
    select * from entries where d between v_from and v_to
  ), totals as (
    select coalesce(sum(usd) filter (where kind = 'order_income'), 0) as order_income,
           coalesce(sum(usd) filter (where kind = 'other_income'), 0) as other_income,
           coalesce(sum(usd) filter (where kind = 'expense'), 0) as expenses
    from period
  )
  select jsonb_build_object(
    'date_from', v_from,
    'date_to', v_to,
    'order_income_usd', t.order_income,
    'other_income_usd', t.other_income,
    'income_usd', t.order_income + t.other_income,
    'expenses_usd', t.expenses,
    'profit_usd', t.order_income + t.other_income - t.expenses,
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', coalesce(c.name, 'Sin categoría'), 'amount_usd', x.total) order by x.total desc)
      from (select category_id, sum(usd) total from period where kind = 'expense' group by category_id) x
      left join public.finance_categories c on c.id = x.category_id
    ), '[]'::jsonb),
    'monthly', (
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m.month, 'YYYY-MM'),
        'income_usd', coalesce((select sum(usd) from entries e where e.kind <> 'expense' and date_trunc('month', e.d) = m.month), 0),
        'expenses_usd', coalesce((select sum(usd) from entries e where e.kind = 'expense' and date_trunc('month', e.d) = m.month), 0)
      ) order by m.month)
      from generate_series(v_series_from, date_trunc('month', v_to)::date, interval '1 month') as m(month)
    )
  ) into v_result
  from totals t;
  return v_result;
end;
$$;

revoke execute on function public.get_finance_dashboard(uuid, date, date) from public, anon;
grant execute on function public.get_finance_dashboard(uuid, date, date) to authenticated;
