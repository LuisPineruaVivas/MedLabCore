-- Security audit run-2: rls/order_items/insert-bypasses-update-only-guards (high).
--
-- The signed-results lock and the lab_admin-only price rule (guard_order_item_update)
-- run only BEFORE UPDATE, but the baseline policy "Users can insert order_items in
-- their org" still let a secretary/bioanalyst add an item with any results and price
-- to a completed, signed order, and a lab_affiliate add result rows to its own orders.
-- Inserts were not audited either (the results audit trigger is AFTER UPDATE).
--
-- The app never inserts order_items directly: items are created only by
-- create_lab_order (SECURITY DEFINER). Same as the orders INSERT policy dropped in
-- 20261019000000, the order_items INSERT policy goes; a BEFORE INSERT guard keeps the
-- same rules if a policy is ever re-added. Super admins keep their ALL policy.

drop policy if exists "Users can insert order_items in their org" on public.order_items;

create or replace function public.guard_order_item_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_status public.order_status;
begin
  if not public.is_api_caller() or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;

  select status into v_status from public.orders where id = new.order_id;
  if v_status in ('completada', 'cancelada') then
    raise exception 'ORDER_RESULTS_LOCKED' using errcode = '42501';
  end if;

  if public.get_my_role() is distinct from 'lab_admin' then
    raise exception 'ORDER_PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_order_item_insert() from public, anon, authenticated;

drop trigger if exists trg_guard_order_item_insert on public.order_items;
create trigger trg_guard_order_item_insert before insert on public.order_items
  for each row execute function public.guard_order_item_insert();
