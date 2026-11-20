-- ERP reports are for lab admins only.
--
-- The inventory report (get_erp_inventory_summary) also allowed bioanalysts,
-- who could open the Reports page through its inventory tab. Bioanalysts keep
-- managing stock from the Inventory page (items, purchases, adjustments,
-- Kardex); only the report itself is restricted. Body unchanged except the
-- role list in erp_assert_access.

CREATE OR REPLACE FUNCTION public.get_erp_inventory_summary(p_org_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_from date; v_to date; v_today date := public.erp_local_date(now());
begin
  perform public.erp_assert_access(p_org_id, array['lab_admin']::public.user_role[]);
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
$function$

;
