-- Authorization fixes from security audit run-1 (2026-10-19).
-- Regression test: supabase/tests/audit_authz_fixes.sql.
--
-- Background: the baseline grants ALL on functions to anon through default
-- privileges, so every SECURITY DEFINER RPC below was callable without a
-- session. Each one now binds p_org_id to the caller and drops anon EXECUTE.
--
-- Row guards (organizations, orders, order_items) are SECURITY INVOKER triggers
-- that only restrict API callers (current_user anon/authenticated). Writes made
-- by SECURITY DEFINER RPCs and triggers (current_user = owner), service_role and
-- migrations are trusted: those RPCs run their own erp_assert_access checks.
-- This is what lets confirm_order_consumption and the payment balance trigger
-- keep updating orders without a separate session flag.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_api_caller()
returns boolean language sql stable set search_path = public as $$
  select current_user in ('anon', 'authenticated')
$$;

create or replace function public.get_my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke execute on function public.is_api_caller() from public, anon;
revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.is_api_caller() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. bulk_upsert_org_prices: super_admin only.
--    (rpc/bulk_upsert_org_prices/missing-super-admin-check)
-- ---------------------------------------------------------------------------
create or replace function public.bulk_upsert_org_prices(p_org_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item         jsonb;
  v_template_id  uuid;
  v_name         text;
  v_price        numeric;
  v_category     text;
  v_schema       jsonb;
  v_org_id_check uuid;
  v_count_ok     int := 0;
  v_count_skip   int := 0;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'ORG_NOT_FOUND';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_template_id := (v_item->>'global_template_id')::uuid;
    v_price       := (v_item->>'price')::numeric;
    if v_price is null or v_price < 0 then
      v_count_skip := v_count_skip + 1;
      continue;
    end if;

    v_name := null;
    select name, category, schema, org_id
    into v_name, v_category, v_schema, v_org_id_check
    from public.test_templates
    where id = v_template_id;

    -- Only a global template (cloned into the org) or the org's own fork.
    if v_name is not null and (v_org_id_check is null or v_org_id_check = p_org_id) then
      perform public.upsert_test_template(v_template_id, p_org_id, v_name, v_category, v_price, v_schema);
      v_count_ok := v_count_ok + 1;
    else
      v_count_skip := v_count_skip + 1;
    end if;
  end loop;

  return jsonb_build_object('applied', v_count_ok, 'skipped', v_count_skip);
end;
$$;

revoke execute on function public.bulk_upsert_org_prices(uuid, jsonb) from public, anon;
grant execute on function public.bulk_upsert_org_prices(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. upsert_exam_profile: lab_admin of p_org_id or super_admin; the UPDATE and
--    template links are scoped to that org.
--    (rpc/upsert_exam_profile/no-caller-org-role-check)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_exam_profile(
  p_profile_id uuid, p_org_id uuid, p_name text, p_description text, p_total_price numeric, p_template_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'super_admin')
    or exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role = 'lab_admin')
  ) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_org_id is null then raise exception 'ORG_REQUIRED'; end if;
  if p_total_price is not null and p_total_price < 0 then raise exception 'INVALID_PRICE'; end if;
  if exists (
    select 1
    from unnest(coalesce(p_template_ids, '{}'::uuid[])) t(id)
    left join public.test_templates tt on tt.id = t.id
    where tt.id is null or (tt.org_id is not null and tt.org_id <> p_org_id)
  ) then
    raise exception 'INVALID_TEMPLATE';
  end if;

  if p_profile_id is null then
    insert into public.exam_profiles (org_id, name, description, total_price)
    values (p_org_id, p_name, nullif(trim(coalesce(p_description, '')), ''), p_total_price)
    returning id into v_profile_id;
  else
    update public.exam_profiles
    set name = p_name,
        description = nullif(trim(coalesce(p_description, '')), ''),
        total_price = p_total_price
    where id = p_profile_id and org_id = p_org_id
    returning id into v_profile_id;
    if v_profile_id is null then raise exception 'PROFILE_NOT_FOUND'; end if;

    delete from public.profile_templates_junction where profile_id = v_profile_id;
  end if;

  if array_length(p_template_ids, 1) is not null then
    insert into public.profile_templates_junction (profile_id, template_id)
    select v_profile_id, unnest(p_template_ids);
  end if;

  return jsonb_build_object(
    'success', true,
    'profileId', v_profile_id,
    'userSafeMessage', 'Perfil guardado correctamente',
    'technicalCode', 'PROFILE_SAVED'
  );
end;
$$;

revoke execute on function public.upsert_exam_profile(uuid, uuid, text, text, numeric, uuid[]) from public, anon;
grant execute on function public.upsert_exam_profile(uuid, uuid, text, text, numeric, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Dashboard RPCs: only staff of p_org_id or super_admin.
--    (rpc/get_dashboard_summary+get_dashboard_top_tests/no-caller-org-binding)
-- ---------------------------------------------------------------------------
create or replace function public.assert_org_member(p_org_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null
     or not (p_org_id = public.get_my_org_id() or public.has_role(auth.uid(), 'super_admin')) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_org_member(uuid) from public, anon;
grant execute on function public.assert_org_member(uuid) to authenticated, service_role;

create or replace function public.get_dashboard_summary(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_org_member(p_org_id);
  return (
    with bounds as (
      select
        (date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas') as today_start,
        (date_trunc('day', (now() at time zone 'America/Caracas') - interval '1 day') at time zone 'America/Caracas') as yesterday_start,
        (date_trunc('month', now() at time zone 'America/Caracas') at time zone 'America/Caracas') as month_start
    )
    select jsonb_build_object(
      'totalPatients', (select count(*) from public.patients p where p.org_id = p_org_id),
      'thisMonthPatients', (select count(*) from public.patients p, bounds b where p.org_id = p_org_id and p.created_at >= b.month_start),
      'ordersToday', (select count(*) from public.orders o, bounds b where o.org_id = p_org_id and o.created_at >= b.today_start),
      'ordersYesterday', (
        select count(*) from public.orders o, bounds b
        where o.org_id = p_org_id and o.created_at >= b.yesterday_start and o.created_at < b.today_start
      ),
      'pendingOrders', (select count(*) from public.orders o where o.org_id = p_org_id and o.status = 'pendiente'),
      'todayRevenue', (
        select coalesce(sum(o.total_amount), 0) from public.orders o, bounds b
        where o.org_id = p_org_id and o.created_at >= b.today_start
      )
    )
  );
end;
$$;

create or replace function public.get_dashboard_top_tests(p_org_id uuid, p_limit integer default 5)
returns table(name text, count bigint, pct integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_org_member(p_org_id);
  return query
  with counted as (
    select oi.test_name, count(*)::bigint as usage_count
    from public.order_items oi
    inner join public.orders o on o.id = oi.order_id
    where o.org_id = p_org_id and oi.is_profile_header = false
    group by oi.test_name
    order by usage_count desc, oi.test_name asc
    limit p_limit
  ),
  max_count as (
    select greatest(coalesce(max(usage_count), 1), 1) as top_count from counted
  )
  select counted.test_name, counted.usage_count,
         round((counted.usage_count::numeric / max_count.top_count::numeric) * 100)::integer
  from counted cross join max_count;
end;
$$;

revoke execute on function public.get_dashboard_summary(uuid) from public, anon;
revoke execute on function public.get_dashboard_top_tests(uuid, integer) from public, anon;
grant execute on function public.get_dashboard_summary(uuid) to authenticated, service_role;
grant execute on function public.get_dashboard_top_tests(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. fn_log_audit_event is only called by the postgres-owned SECURITY DEFINER
--    audit triggers; it is not an API.
--    (rpc/fn_log_audit_event/forgeable-cross-tenant-audit)
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_log_audit_event(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_log_audit_event(uuid, text, text, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 5. create_lab_order: patient must belong to the org, prices are non-negative,
--    and lab_affiliate cannot exempt. Orders are only created through the RPC.
--    (rpc/create_lab_order/patient-org-unbound,
--     rpc/create_lab_order/client-price-and-exemption-trusted)
-- ---------------------------------------------------------------------------
create or replace function public.create_lab_order(
  p_org_id uuid, p_patient_id uuid, p_notes text, p_exchange_rate numeric, p_total_bs numeric,
  p_is_exempted boolean, p_items jsonb, p_created_by uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  if not exists (select 1 from public.patients where id = p_patient_id and org_id = p_org_id) then
    raise exception 'INVALID_PATIENT';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ORDER_ITEMS_REQUIRED'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) item where coalesce((item->>'price')::numeric, 0) < 0)
     or coalesce(p_total_bs, 0) < 0 or coalesce(p_exchange_rate, 0) < 0 then
    raise exception 'INVALID_PRICE';
  end if;
  if coalesce(p_is_exempted, false) and v_user_role = 'lab_affiliate' then raise exception 'EXEMPTION_NOT_ALLOWED'; end if;
  if v_user_role = 'lab_affiliate' then v_payment_status := 'pending'; end if;
  select coalesce(sum(coalesce((item->>'price')::numeric, 0)), 0) into v_total_amount from jsonb_array_elements(p_items) item;
  v_effective_total_amount := case when coalesce(p_is_exempted, false) then 0 else v_total_amount end;
  v_effective_total_bs := case
    when coalesce(p_is_exempted, false) and p_total_bs is not null then 0
    when coalesce(p_is_exempted, false) then null
    else p_total_bs
  end;
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
    values (p_org_id, '', 0, v_order.id, p_patient_id, v_effective_total_amount, v_effective_total_amount, v_rate_id, p_exchange_rate, v_effective_total_bs, 0, v_effective_total_amount,
            (case when coalesce(p_is_exempted, false) then 'paid' else 'issued' end)::public.invoice_status,
            coalesce(p_is_exempted, false), p_created_by)
    returning id into v_invoice_id;
    update public.orders set invoice_id = v_invoice_id where id = v_order.id;
  end if;
  return jsonb_build_object('success', true, 'orderId', v_order.id, 'invoiceId', v_invoice_id, 'access_pin', v_order.access_pin, 'order_seq', v_order.order_seq, 'userSafeMessage', 'Orden creada correctamente', 'technicalCode', 'ORDER_CREATED');
end;
$$;

revoke execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) from public, anon;
grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) to authenticated, service_role;

-- The app never inserts orders directly (only through create_lab_order, which
-- is SECURITY DEFINER and bypasses RLS). The direct path let a lab_affiliate
-- insert paid/exempted/zero-total orders. Super admins keep their ALL policy.
drop policy if exists "Users can insert orders in their org" on public.orders;

-- ---------------------------------------------------------------------------
-- 6. ERP invoices and schedules may only reference rows of their own org; the
--    AR report and the balance trigger re-check the org anyway.
--    (erp-invoice-foreign-refs-not-org-bound)
-- ---------------------------------------------------------------------------
create or replace function public.trg_fn_invoice_refs_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orders where id = new.order_id and org_id = new.org_id)
     or not exists (select 1 from public.patients where id = new.patient_id and org_id = new.org_id) then
    raise exception 'ERP_CROSS_ORG_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_refs_same_org on public.invoices;
create trigger trg_invoice_refs_same_org before insert or update of org_id, order_id, patient_id on public.invoices
  for each row execute function public.trg_fn_invoice_refs_same_org();

create or replace function public.trg_fn_schedule_refs_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.invoices where id = new.invoice_id and org_id = new.org_id) then
    raise exception 'ERP_CROSS_ORG_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_refs_same_org on public.payment_schedules;
create trigger trg_schedule_refs_same_org before insert or update of org_id, invoice_id on public.payment_schedules
  for each row execute function public.trg_fn_schedule_refs_same_org();

revoke execute on function public.trg_fn_invoice_refs_same_org() from public, anon, authenticated;
revoke execute on function public.trg_fn_schedule_refs_same_org() from public, anon, authenticated;

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
      left join public.patients p on p.id = b.patient_id and p.org_id = p_org_id
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
  update public.orders o
  set payment_status = case when v_status = 'paid' then 'paid'::public.payment_status when v_status = 'partial' then 'partial'::public.payment_status else 'unpaid'::public.payment_status end
  from public.invoices i
  where i.id = v_invoice_id and o.id = i.order_id and o.org_id = i.org_id;

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

-- ---------------------------------------------------------------------------
-- 7a. Operator flags on organizations: only super_admin or trusted server code.
--     (rls/organizations/lab-admin-update-operator-flags-no-column-guard)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_org_flag_self_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_api_caller()
     and not public.has_role(auth.uid(), 'super_admin')
     and (old.has_erp_module is distinct from new.has_erp_module
       or old.subscription_active is distinct from new.subscription_active
       or old.is_active is distinct from new.is_active) then
    raise exception 'ORG_FLAGS_FORBIDDEN: only the operator can change organization plan flags' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_org_flag_self_update on public.organizations;
create trigger trg_prevent_org_flag_self_update before update on public.organizations
  for each row execute function public.prevent_org_flag_self_update();

-- ---------------------------------------------------------------------------
-- 7b. Anonymous branding read: one org, whitelisted columns, via RPC.
--     (rls/organizations/anon-select-all-rows-all-columns)
--     Authenticated users keep "Users can view their own organization" and
--     super admins "Admins can manage organizations".
-- ---------------------------------------------------------------------------
drop policy if exists "Public organization branding is viewable by anyone" on public.organizations;
revoke all on table public.organizations from anon;

create or replace function public.get_public_org_brand(p_org_id uuid)
returns table(name text, logo_url text, primary_color text, secondary_color text, email text, phone text, address text, report_template text)
language sql stable security definer set search_path = public as $$
  select o.name, o.logo_url, o.primary_color, o.secondary_color, o.email, o.phone, o.address, o.report_template
  from public.organizations o
  where o.id = p_org_id
$$;

revoke execute on function public.get_public_org_brand(uuid) from public;
grant execute on function public.get_public_org_brand(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Order workflow guards.
--    (rls/orders+order_items/update-no-role-transition-or-column-guard)
--    API callers (not super_admin):
--    * only a bioanalyst completes/signs, in labs without ERP (ERP labs go through
--      confirm_order_consumption); the signature always comes from the signer's
--      own profile;
--    * consumption and invoice links are written only by RPCs;
--    * a completed order cannot change status;
--    * payment fields are lab_admin only (affiliate settlement);
--    * results of completed/cancelled orders are immutable, item prices are
--      lab_admin only.
-- ---------------------------------------------------------------------------
create or replace function public.guard_order_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_role public.user_role;
  v_completing boolean := new.status = 'completada' and old.status is distinct from 'completada';
  v_erp boolean;
begin
  if not public.is_api_caller() or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;
  v_role := public.get_my_role();

  if old.status = 'completada' and new.status is distinct from old.status then
    raise exception 'ORDER_COMPLETED_LOCKED' using errcode = '42501';
  end if;

  if (new.consumption_confirmed_at, new.consumption_confirmed_by, new.invoice_id)
     is distinct from (old.consumption_confirmed_at, old.consumption_confirmed_by, old.invoice_id) then
    raise exception 'ORDER_RPC_ONLY_FIELDS' using errcode = '42501';
  end if;

  if v_completing
     or (new.firma_url, new.firma_name, new.sello_url, new.signature_footer_text)
        is distinct from (old.firma_url, old.firma_name, old.sello_url, old.signature_footer_text) then
    if v_role is distinct from 'bioanalyst' then
      raise exception 'ORDER_SIGN_FORBIDDEN' using errcode = '42501';
    end if;
    if v_completing then
      select has_erp_module into v_erp from public.organizations where id = new.org_id;
      if coalesce(v_erp, false) then
        raise exception 'ORDER_COMPLETION_REQUIRES_CONSUMPTION' using errcode = '42501';
      end if;
    end if;
    select p.firma_url, p.full_name, p.sello_url, p.signature_footer_text
    into new.firma_url, new.firma_name, new.sello_url, new.signature_footer_text
    from public.profiles p where p.id = auth.uid();
  end if;

  if (new.payment_status, new.total_amount, new.total_bs, new.is_exempted)
     is distinct from (old.payment_status, old.total_amount, old.total_bs, old.is_exempted)
     and v_role is distinct from 'lab_admin' then
    raise exception 'ORDER_PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_update on public.orders;
create trigger trg_guard_order_update before update on public.orders
  for each row execute function public.guard_order_update();

create or replace function public.guard_order_item_update()
returns trigger language plpgsql set search_path = public as $$
declare v_status public.order_status;
begin
  if not public.is_api_caller() or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;

  if (new.results_data, new.test_method_id, new.method_name)
     is distinct from (old.results_data, old.test_method_id, old.method_name) then
    select status into v_status from public.orders where id = new.order_id;
    if v_status in ('completada', 'cancelada') then
      raise exception 'ORDER_RESULTS_LOCKED' using errcode = '42501';
    end if;
  end if;

  if (new.price_at_order, new.order_id) is distinct from (old.price_at_order, old.order_id)
     and public.get_my_role() is distinct from 'lab_admin' then
    raise exception 'ORDER_PAYMENT_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_item_update on public.order_items;
create trigger trg_guard_order_item_update before update on public.order_items
  for each row execute function public.guard_order_item_update();

revoke execute on function public.prevent_org_flag_self_update() from public, anon;
revoke execute on function public.guard_order_update() from public, anon;
revoke execute on function public.guard_order_item_update() from public, anon;

-- confirm_order_consumption: the signature is taken from the signer's profile,
-- never from the client payload (any non-null p_signature means "sign").
create or replace function public.confirm_order_consumption(p_order_id uuid, p_consumptions jsonb, p_signature jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_invoice_id uuid;
  v_line jsonb;
  v_item public.items%rowtype;
  v_quantity numeric;
  v_order_item_id uuid;
  v_consumption_id uuid;
  v_total numeric := 0;
  v_lines integer := 0;
  v_signer public.profiles%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  perform public.erp_assert_access(v_order.org_id, array['lab_admin', 'bioanalyst']::public.user_role[]);
  if v_order.consumption_confirmed_at is not null then raise exception 'CONSUMPTION_ALREADY_CONFIRMED'; end if;
  if v_order.status in ('completada', 'cancelada') then raise exception 'ORDER_NOT_COMPLETABLE'; end if;
  if p_consumptions is not null and jsonb_typeof(p_consumptions) <> 'array' then raise exception 'INVALID_CONSUMPTIONS'; end if;

  select id into v_invoice_id from public.invoices where order_id = p_order_id;

  for v_line in select value from jsonb_array_elements(coalesce(p_consumptions, '[]'::jsonb)) loop
    v_quantity := nullif(v_line->>'quantity', '')::numeric;
    if v_quantity is null or v_quantity <= 0 then raise exception 'INVALID_MOVEMENT_QUANTITY'; end if;
    select * into v_item from public.items where id = nullif(v_line->>'item_id', '')::uuid and org_id = v_order.org_id;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
    v_order_item_id := nullif(v_line->>'order_item_id', '')::uuid;
    if v_order_item_id is not null and not exists (select 1 from public.order_items where id = v_order_item_id and order_id = p_order_id) then
      raise exception 'INVALID_ORDER_ITEM';
    end if;

    insert into public.invoice_consumptions (
      org_id, invoice_id, order_id, item_id, order_item_id, quantity_consumed,
      unit_cost_at_consumption, total_cost, was_adjusted, is_extra, adjustment_reason, confirmed_by
    ) values (
      v_order.org_id, v_invoice_id, p_order_id, v_item.id, v_order_item_id, v_quantity,
      v_item.unit_cost, round(v_quantity * v_item.unit_cost, 4),
      coalesce((v_line->>'was_adjusted')::boolean, false), coalesce((v_line->>'is_extra')::boolean, false),
      nullif(trim(coalesce(v_line->>'reason', '')), ''), auth.uid()
    ) returning id into v_consumption_id;

    -- The Kardex trigger discounts stock and raises INSUFFICIENT_STOCK, rolling back everything.
    insert into public.inventory_transactions (org_id, item_id, transaction_type, quantity, reference_type, reference_id, invoice_consumption_id, notes, created_by)
    values (v_order.org_id, v_item.id, 'consumption', -v_quantity, 'order', p_order_id, v_consumption_id,
            'Orden #' || coalesce(v_order.order_seq::text, p_order_id::text), auth.uid());

    v_total := v_total + round(v_quantity * v_item.unit_cost, 4);
    v_lines := v_lines + 1;
  end loop;

  if p_signature is not null then
    select * into v_signer from public.profiles where id = auth.uid();
  end if;

  update public.orders
  set status = 'completada',
      completed_at = now(),
      consumption_confirmed_at = now(),
      consumption_confirmed_by = auth.uid(),
      firma_url = case when p_signature is not null then v_signer.firma_url else firma_url end,
      firma_name = case when p_signature is not null then v_signer.full_name else firma_name end,
      sello_url = case when p_signature is not null then v_signer.sello_url else sello_url end,
      signature_footer_text = case when p_signature is not null then v_signer.signature_footer_text else signature_footer_text end
  where id = p_order_id;

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'lines', v_lines, 'total_cost', round(v_total, 2));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. ERP finance reads: ERP-enabled orgs, lab_admin and secretary only.
--    (erp-finance-read-policy-any-org-member)
-- ---------------------------------------------------------------------------
drop policy if exists "ERP members read invoices" on public.invoices;
create policy "ERP finance read invoices" on public.invoices for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));

drop policy if exists "ERP members read payments" on public.payments;
create policy "ERP finance read payments" on public.payments for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));

drop policy if exists "ERP members read schedules" on public.payment_schedules;
create policy "ERP finance read schedules" on public.payment_schedules for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));

drop policy if exists "ERP members read bank accounts" on public.bank_accounts;
create policy "ERP finance read bank accounts" on public.bank_accounts for select to authenticated
  using (public.erp_user_has_role(org_id, array['lab_admin', 'secretary']::public.user_role[]));
