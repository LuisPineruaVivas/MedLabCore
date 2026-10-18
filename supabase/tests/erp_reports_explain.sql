-- Performance check of the ERP report RPCs (phase 8.5) on synthetic volume.
-- Seeds two labs with ~1 year of data inside a transaction and rolls back.
--   docker exec -i supabase_db_GitMed psql -U postgres -q < supabase/tests/erp_reports_explain.sql
-- Prints each report's duration and the plan of the hottest report query.

begin;
-- Bulk seed without per-row triggers/FK checks (payments' balance trigger would make it slow).
set local session_replication_role = replica;

create temp table perf (k text primary key, v uuid);
insert into perf values ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()), ('admin', gen_random_uuid());

insert into public.organizations (id, name, has_erp_module)
select v, 'Perf ' || k, true from perf where k in ('orgA', 'orgB');
insert into auth.users (id, email) select v, 'perf-admin@erp-test.local' from perf where k = 'admin';
insert into public.user_roles (user_id, role) select v, 'super_admin' from perf where k = 'admin';
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
select gen_random_uuid(), o.v, 'PERF-' || g, 'Paciente', g::text, '1990-01-01', 'femenino', (select v from perf where k = 'admin')
from perf o, generate_series(1, 2000) g where o.k in ('orgA', 'orgB');

-- 40k invoices and 60k payments per lab spread over the last 365 days.
insert into public.invoices (org_id, invoice_number, invoice_seq, order_id, patient_id, subtotal_usd, total_usd, amount_paid_usd, balance_due_usd, status, issued_at, created_by)
select o.v, 'PERF-' || o.k || '-' || g, g, gen_random_uuid(),
       (select p.id from public.patients p where p.org_id = o.v and p.id_number = 'PERF-' || (1 + g % 2000)), 20, 20,
       case when g % 4 = 0 then 0 else 20 end, case when g % 4 = 0 then 20 else 0 end,
       (case when g % 4 = 0 then 'issued' else 'paid' end)::public.invoice_status,
       now() - (random() * interval '365 days'), (select v from perf where k = 'admin')
from perf o, generate_series(1, 40000) g where o.k in ('orgA', 'orgB');

insert into public.payments (org_id, invoice_id, amount, currency, amount_usd, payment_method, method_type, payment_date, created_by)
select i.org_id, i.id, 20, 'USD', 20, 'Efectivo USD', 'cash', i.issued_at + interval '1 hour', (select v from perf where k = 'admin')
from public.invoices i join perf o on o.v = i.org_id
cross join generate_series(1, 2) n
where i.status = 'paid' and (n = 1 or i.invoice_seq % 2 = 0);

set local session_replication_role = origin;
analyze public.invoices;
analyze public.payments;

select set_config('request.jwt.claims', json_build_object('sub', (select v from perf where k = 'admin'), 'role', 'authenticated')::text, true);

do $$
declare v_start timestamptz; v_org uuid := (select v from perf where k = 'orgA'); v_name text;
begin
  foreach v_name in array array['financial', 'profitability', 'inventory', 'receivables'] loop
    v_start := clock_timestamp();
    case v_name
      when 'financial' then perform public.get_erp_financial_summary(v_org, current_date - 30, current_date);
      when 'profitability' then perform public.get_erp_profitability_report(v_org, current_date - 30, current_date);
      when 'inventory' then perform public.get_erp_inventory_summary(v_org, current_date - 30, current_date);
      when 'receivables' then perform public.get_accounts_receivable_report(v_org);
    end case;
    raise notice '% report: % ms', v_name, round(extract(epoch from clock_timestamp() - v_start) * 1000);
  end loop;
end $$;

-- Hottest query of the financial summary: payments of one lab in a 30-day local-date range.
explain (analyze, costs off, timing off, summary on)
select sum(amount_usd) from public.payments
where org_id = (select v from perf where k = 'orgA') and not is_void
  and public.erp_local_date(payment_date) between current_date - 30 and current_date;

rollback;
