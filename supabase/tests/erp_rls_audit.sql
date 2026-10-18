-- Static security audit of the ERP schema (phase 8.4). Read-only; run before every deploy:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/erp_rls_audit.sql
-- Aborts on the first violation; prints "ERP RLS audit passed" otherwise.
-- Runtime cross-tenant checks live in erp_rpcs_smoke.sql.

do $$
declare
  v_tables text[] := array[
    'exchange_rate_history', 'bank_accounts', 'invoices', 'invoice_sequences', 'payments', 'payment_schedules',
    'cash_register_sessions', 'items', 'inventory_transactions', 'test_materials', 'invoice_consumptions'
  ];
  -- Ledger tables: written only by SECURITY DEFINER RPCs/triggers, never directly.
  v_rpc_only text[] := array['invoice_sequences', 'payments', 'inventory_transactions', 'invoice_consumptions', 'cash_register_sessions'];
  v_functions text[] := array[
    'get_exchange_rate', 'register_payment', 'void_payment', 'create_payment_schedule', 'open_cash_session',
    'close_cash_session', 'get_cash_session_summary', 'review_cash_session', 'register_purchase', 'register_adjustment',
    'get_order_bom_preview', 'confirm_order_consumption', 'get_erp_financial_summary', 'get_erp_profitability_report',
    'get_erp_inventory_summary', 'get_accounts_receivable_report', 'erp_backfill_invoices', 'mark_overdue_invoices',
    'erp_cash_session_totals', 'erp_invoice_overdue_amount'
  ];
  v_name text;
  v_bad text;
begin
  -- 1. RLS enabled on every ERP table.
  foreach v_name in array v_tables loop
    if not exists (select 1 from pg_class where oid = ('public.' || v_name)::regclass and relrowsecurity) then
      raise exception 'RLS disabled on public.%', v_name;
    end if;
    -- 2. No table privilege for anonymous clients.
    if has_table_privilege('anon', 'public.' || v_name, 'select,insert,update,delete') then
      raise exception 'anon has privileges on public.%', v_name;
    end if;
  end loop;

  -- 3. Policies only target authenticated users.
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
  from pg_policies
  where schemaname = 'public' and tablename = any(v_tables) and not (roles = array['authenticated']::name[]);
  if v_bad is not null then raise exception 'Policies not limited to authenticated: %', v_bad; end if;

  -- 4. Ledger tables have no direct write policies.
  select string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ') into v_bad
  from pg_policies
  where schemaname = 'public' and tablename = any(v_rpc_only) and cmd <> 'SELECT';
  if v_bad is not null then raise exception 'Direct write policies on ledger tables: %', v_bad; end if;

  -- 5. Every write/update policy on the other tables has a WITH CHECK (or is a DELETE).
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
  from pg_policies
  where schemaname = 'public' and tablename = any(v_tables) and cmd in ('INSERT', 'UPDATE', 'ALL') and with_check is null;
  if v_bad is not null then raise exception 'Write policies without WITH CHECK: %', v_bad; end if;

  -- 6. SECURITY DEFINER functions pin search_path; anon cannot execute ERP RPCs.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(v_functions)
    and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if v_bad is not null then raise exception 'SECURITY DEFINER without search_path: %', v_bad; end if;

  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(v_functions)
    and has_function_privilege('anon', p.oid, 'execute');
  if v_bad is not null then raise exception 'anon can execute: %', v_bad; end if;

  -- 7. Internal helpers and the cron job are not callable by signed-in users either.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('erp_cash_session_totals', 'erp_invoice_overdue_amount', 'mark_overdue_invoices')
    and has_function_privilege('authenticated', p.oid, 'execute');
  if v_bad is not null then raise exception 'authenticated can execute internal helpers: %', v_bad; end if;

  raise notice 'ERP RLS audit passed';
end;
$$;
