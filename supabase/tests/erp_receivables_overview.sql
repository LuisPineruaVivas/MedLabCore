-- Test for migration 20261108020000_erp_receivables_overview (ERP finances, phase 3).
-- Rolled back. Prints "ERP receivables overview passed".
--   npm run test:db -- erp_receivables_overview

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    if sqlerrm !~ p_pattern then
      raise exception 'Expected error matching "%" but got "%" for: %', p_pattern, sqlerrm, p_sql;
    end if;
  end;
  if not v_failed then
    raise exception 'Expected error matching "%" but statement succeeded: %', p_pattern, p_sql;
  end if;
end;
$$;

create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'Assertion failed: %', p_label; end if;
end;
$$;

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create temp table ids (k text primary key, v uuid);
insert into ids values
  ('org', gen_random_uuid()), ('other_org', gen_random_uuid()), ('admin', gen_random_uuid()), ('sec', gen_random_uuid()),
  ('bio', gen_random_uuid()), ('other_admin', gen_random_uuid()), ('patient', gen_random_uuid()),
  ('o1', gen_random_uuid()), ('o2', gen_random_uuid()), ('o3', gen_random_uuid()),
  ('i1', gen_random_uuid()), ('i2', gen_random_uuid()), ('i3', gen_random_uuid());
grant select on ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;
create function pg_temp.overview() returns jsonb language sql as $$ select public.get_receivables_overview(pg_temp.id('org')) $$;

insert into public.organizations (id, name, has_erp_module) values
  (pg_temp.id('org'), 'Receivables Lab', true), (pg_temp.id('other_org'), 'Other Receivables Lab', true);
insert into auth.users (id, email) select v, k || '@receivables.local' from ids where k in ('admin', 'sec', 'bio', 'other_admin');
insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('admin'), pg_temp.id('org'), 'lab_admin', 'Admin', 'admin@receivables.local'),
  (pg_temp.id('sec'), pg_temp.id('org'), 'secretary', 'Sec', 'sec@receivables.local'),
  (pg_temp.id('bio'), pg_temp.id('org'), 'bioanalyst', 'Bio', 'bio@receivables.local'),
  (pg_temp.id('other_admin'), pg_temp.id('other_org'), 'lab_admin', 'Other', 'other@receivables.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;
insert into public.patients (id, org_id, id_number, first_name, last_name, date_of_birth, gender, created_by)
values (pg_temp.id('patient'), pg_temp.id('org'), 'REC-1', 'Pac', 'Uno', '1990-01-01', 'femenino', pg_temp.id('admin'));
insert into public.orders (id, org_id, patient_id, created_by)
select pg_temp.id(k), pg_temp.id('org'), pg_temp.id('patient'), pg_temp.id('admin') from unnest(array['o1', 'o2', 'o3']) k;

-- i1: 100 owed on a 3-installment plan (10 already paid on the first one).
-- i2: 50 owed, no plan. i3: cancelled, ignored.
insert into public.invoices (id, org_id, invoice_number, invoice_seq, order_id, patient_id, created_by, subtotal_usd, total_usd, balance_due_usd, amount_paid_usd, status) values
  (pg_temp.id('i1'), pg_temp.id('org'), 'REC-1', 1, pg_temp.id('o1'), pg_temp.id('patient'), pg_temp.id('admin'), 110, 110, 100, 10, 'partial'),
  (pg_temp.id('i2'), pg_temp.id('org'), 'REC-2', 2, pg_temp.id('o2'), pg_temp.id('patient'), pg_temp.id('admin'), 50, 50, 50, 0, 'issued'),
  (pg_temp.id('i3'), pg_temp.id('org'), 'REC-3', 3, pg_temp.id('o3'), pg_temp.id('patient'), pg_temp.id('admin'), 70, 70, 70, 0, 'cancelled');
insert into public.payment_schedules (org_id, invoice_id, installment_number, amount_due_usd, amount_paid_usd, due_date, status) values
  (pg_temp.id('org'), pg_temp.id('i1'), 1, 40, 10, current_date - 5, 'partial'),  -- 30 overdue
  (pg_temp.id('org'), pg_temp.id('i1'), 2, 30, 0, current_date, 'pending'),       -- due today: this week and this month
  (pg_temp.id('org'), pg_temp.id('i1'), 3, 40, 0, current_date + 40, 'pending'),  -- beyond this month
  (pg_temp.id('org'), pg_temp.id('i3'), 1, 70, 0, current_date - 1, 'pending');   -- cancelled invoice, ignored

select pg_temp.act_as(pg_temp.id('sec'));
select pg_temp.assert_true((pg_temp.overview()->>'total_usd')::numeric = 150, 'total open balance 100 + 50');
select pg_temp.assert_true((pg_temp.overview()->>'open_invoices')::int = 2, 'two open invoices');
select pg_temp.assert_true((pg_temp.overview()->>'unscheduled_usd')::numeric = 50 and (pg_temp.overview()->>'unscheduled_count')::int = 1, 'one balance without plan');
select pg_temp.assert_true((pg_temp.overview()->>'overdue_usd')::numeric = 30 and (pg_temp.overview()->>'overdue_count')::int = 1, 'overdue: 40 - 10 paid');
select pg_temp.assert_true((pg_temp.overview()->>'due_week_usd')::numeric = 30 and (pg_temp.overview()->>'due_week_count')::int = 1, 'due this week');
select pg_temp.assert_true((pg_temp.overview()->>'due_month_usd')::numeric = 30, 'due this month excludes the one in 40 days');
-- The list behind the screen: secretaries read the open installments through RLS.
select pg_temp.assert_true((select count(*) = 4 from public.payment_schedules), 'secretary reads the lab installments');
reset role;

select pg_temp.act_as(pg_temp.id('bio'));
select pg_temp.expect_error('select pg_temp.overview()', 'ERP_PERMISSION_DENIED');
select pg_temp.assert_true((select count(*) = 0 from public.payment_schedules), 'bioanalyst reads no installments');
select pg_temp.act_as(pg_temp.id('other_admin'));
select pg_temp.expect_error('select pg_temp.overview()', 'ERP_PERMISSION_DENIED');
reset role;

do $$ begin raise notice 'ERP receivables overview passed'; end $$;
rollback;
