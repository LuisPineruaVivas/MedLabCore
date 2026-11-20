-- Improvement plan S-07: low-risk hardening items from security audit run-1 (§5).
-- Each item keeps every current screen working (checked against the app's queries):
--
-- 1. antibiotics: writes limited to lab staff who enter results (lab_admin, bioanalyst,
--    secretary) and super_admin. lab_affiliate could edit the lab's antibiotic list.
-- 2. organization_exam_settings: members still read it (order item sorting); writes are
--    limited to lab_admin / bioanalyst / super_admin. The app never writes it directly.
-- 3. exchange_rates: drop "Public can read exchange rates" (USING true, also anon).
--    Logged-in users still read their own lab's rate.
-- 4. v_test_templates_filtered: was owned by postgres (bypassing RLS) with full rights
--    for anon. Now security_invoker (test_templates RLS gives the same rows to signed-in
--    users) and read-only for authenticated; anon has no access.
-- 5. profiles: lab_affiliate users see only their own profile, not the lab's staff list.
-- 6. get_my_org_id: fixed search_path (SECURITY DEFINER).
-- 7. order_items: result edits are written to audit_logs (ORDER_RESULTS_UPDATED).
-- (confirm_order_consumption already takes the signature from the signer's profile:
--  migration 20261019000000.)

-- 1. antibiotics -------------------------------------------------------------------
drop policy if exists lab_staff_can_manage_antibiotics on public.antibiotics;
create policy lab_staff_can_manage_antibiotics on public.antibiotics
  for all to authenticated
  using (org_id = public.get_my_org_id()
         and public.get_my_role() in ('lab_admin', 'bioanalyst', 'secretary', 'super_admin'))
  with check (org_id = public.get_my_org_id()
              and public.get_my_role() in ('lab_admin', 'bioanalyst', 'secretary', 'super_admin'));

-- 2. organization_exam_settings ------------------------------------------------------
drop policy if exists organization_exam_settings_full_access on public.organization_exam_settings;
create policy organization_exam_settings_read on public.organization_exam_settings
  for select to authenticated
  using (org_id = public.get_my_org_id());
create policy organization_exam_settings_write on public.organization_exam_settings
  for all to authenticated
  using (org_id = public.get_my_org_id()
         and public.get_my_role() in ('lab_admin', 'bioanalyst', 'super_admin'))
  with check (org_id = public.get_my_org_id()
              and public.get_my_role() in ('lab_admin', 'bioanalyst', 'super_admin'));

-- 3. exchange_rates ------------------------------------------------------------------
drop policy if exists "Public can read exchange rates" on public.exchange_rates;

-- 4. v_test_templates_filtered -------------------------------------------------------
alter view public.v_test_templates_filtered set (security_invoker = true);
revoke all on public.v_test_templates_filtered from anon, authenticated;
grant select on public.v_test_templates_filtered to authenticated;

-- 5. profiles --------------------------------------------------------------------------
drop policy if exists "Members of the same org can view each other" on public.profiles;
create policy "Members of the same org can view each other" on public.profiles
  for select to authenticated
  using (org_id = public.get_my_org_id() and public.get_my_role() is distinct from 'lab_affiliate');
-- ("Users can read own profile" still lets affiliates read their own row.)

-- 6. get_my_org_id ---------------------------------------------------------------------
alter function public.get_my_org_id() set search_path = public;

-- 7. Audit trail for result edits ----------------------------------------------------
create or replace function public.trg_fn_audit_order_item_results()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if (new.results_data, new.test_method_id, new.method_name)
     is not distinct from (old.results_data, old.test_method_id, old.method_name) then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  perform public.fn_log_audit_event(
    v_order.org_id,
    'ORDER_RESULTS_UPDATED',
    'orders',
    new.order_id,
    jsonb_build_object(
      'order_seq', v_order.order_seq,
      'order_item_id', new.id,
      'test_name', new.test_name,
      'old_results', old.results_data,
      'new_results', new.results_data,
      'old_method', old.method_name,
      'new_method', new.method_name
    )
  );
  return new;
end;
$$;

revoke execute on function public.trg_fn_audit_order_item_results() from public, anon, authenticated;

drop trigger if exists trg_audit_order_item_results on public.order_items;
create trigger trg_audit_order_item_results after update on public.order_items
  for each row execute function public.trg_fn_audit_order_item_results();
