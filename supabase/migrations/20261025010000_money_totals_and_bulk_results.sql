-- Improvement plan Phase 2 (B-01, B-02, P-03, B-03, P-04).
--
-- Billing and affiliate totals were summed in the browser over every order, and
-- PostgREST returns at most 1,000 rows, so totals were silently low for larger labs.
-- "Guardar todo" sent one update per exam and could leave a partial save.
--
-- All three functions are SECURITY INVOKER on purpose: they run with the caller's
-- own RLS, so totals cover exactly the orders the caller could already read, and
-- result saves still go through guard_order_item_update (ORDER_RESULTS_LOCKED), which
-- only applies to API callers and would be skipped by a SECURITY DEFINER function.

-- Billing page cards. Same rules the page used before:
--   total_revenue      = sum of every order in the selected month (all time if none);
--   this_month_revenue = sum of orders since p_month_start (the browser's month start);
--   pending_count      = orders with status 'pendiente' in the selected month.
create or replace function public.get_billing_totals(
  p_org_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_month_start timestamptz default null
)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total_revenue', coalesce(sum(o.total_amount) filter (
      where (p_from is null or o.created_at >= p_from) and (p_to is null or o.created_at < p_to)), 0),
    'this_month_revenue', coalesce(sum(o.total_amount) filter (
      where p_month_start is not null and o.created_at >= p_month_start), 0),
    'pending_count', count(*) filter (
      where o.status = 'pendiente'
        and (p_from is null or o.created_at >= p_from) and (p_to is null or o.created_at < p_to))
  )
  from public.orders o
  where o.org_id = p_org_id
$$;

-- Amount an affiliate owes: their orders still marked 'pending'.
create or replace function public.get_affiliate_pending_balance(p_affiliate_id uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select coalesce(sum(o.total_amount), 0)
  from public.orders o
  where o.created_by = p_affiliate_id and o.payment_status = 'pending'
$$;

-- Saves the results of several exams of one order in a single transaction:
-- either every item is updated or none is.
-- p_items: [{ "item_id": uuid, "results_data": jsonb, "test_method_id": uuid|null, "method_name": text|null }]
create or replace function public.save_order_results(p_order_id uuid, p_items jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_expected integer;
  v_updated integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_RESULTS_PAYLOAD' using errcode = '22023';
  end if;

  select count(distinct e->>'item_id') into v_expected from jsonb_array_elements(p_items) e;

  with input as (
    select distinct on ((e->>'item_id')::uuid)
      (e->>'item_id')::uuid as item_id,
      nullif(e->'results_data', 'null'::jsonb) as results_data,
      nullif(e->>'test_method_id', '')::uuid as test_method_id,
      e->>'method_name' as method_name
    from jsonb_array_elements(p_items) e
  )
  update public.order_items oi
  set results_data = i.results_data,
      test_method_id = i.test_method_id,
      method_name = i.method_name
  from input i
  where oi.id = i.item_id and oi.order_id = p_order_id;

  get diagnostics v_updated = row_count;

  -- An item of another order, or one RLS hides from the caller, updates nothing:
  -- refuse the whole save so nothing is half-written.
  if v_updated <> v_expected then
    raise exception 'ORDER_ITEMS_NOT_FOUND' using errcode = '22023';
  end if;

  return v_updated;
end;
$$;

revoke execute on function public.get_billing_totals(uuid, timestamptz, timestamptz, timestamptz) from public, anon;
revoke execute on function public.get_affiliate_pending_balance(uuid) from public, anon;
revoke execute on function public.save_order_results(uuid, jsonb) from public, anon;
grant execute on function public.get_billing_totals(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_affiliate_pending_balance(uuid) to authenticated;
grant execute on function public.save_order_results(uuid, jsonb) to authenticated;
