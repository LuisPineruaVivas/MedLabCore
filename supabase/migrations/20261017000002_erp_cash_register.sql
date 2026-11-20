-- ERP phase 4: one active cash session per laboratory and reconciled closures.
create type public.cash_session_status as enum ('open', 'closed', 'reviewed');
create table public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  opened_by uuid not null references auth.users(id), closed_by uuid references auth.users(id), operator_name text not null,
  opened_at timestamptz not null default now(), closed_at timestamptz,
  opening_cash_usd numeric(12,2) not null default 0 check (opening_cash_usd >= 0), opening_cash_ves numeric(14,2) not null default 0 check (opening_cash_ves >= 0),
  expected_totals jsonb, actual_totals jsonb, difference jsonb,
  status public.cash_session_status not null default 'open', notes text, closing_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index cash_sessions_one_open_per_org on public.cash_register_sessions(org_id) where status = 'open';
create trigger trg_cash_sessions_updated_at before update on public.cash_register_sessions for each row execute function public.handle_updated_at();
alter table public.payments add constraint payments_cash_session_fkey foreign key (cash_session_id) references public.cash_register_sessions(id) on delete set null;
alter table public.cash_register_sessions enable row level security;
create policy "ERP cash operators read sessions" on public.cash_register_sessions for select to authenticated using (public.has_role(auth.uid(), 'super_admin') or org_id = (select org_id from public.profiles where id = auth.uid()));

create or replace function public.open_cash_session(p_org_id uuid, p_opening_usd numeric default 0, p_opening_ves numeric default 0, p_notes text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_id uuid; begin
  select full_name into v_name from public.profiles where id = auth.uid() and org_id = p_org_id;
  if not public.has_role(auth.uid(), 'super_admin') and v_name is null then raise exception 'CASH_PERMISSION_DENIED'; end if;
  if exists(select 1 from public.cash_register_sessions where org_id=p_org_id and status='open') then raise exception 'CASH_SESSION_ALREADY_OPEN'; end if;
  insert into public.cash_register_sessions(org_id,opened_by,operator_name,opening_cash_usd,opening_cash_ves,notes) values(p_org_id,auth.uid(),coalesce(v_name,'Super admin'),coalesce(p_opening_usd,0),coalesce(p_opening_ves,0),nullif(trim(coalesce(p_notes,'')),'')) returning id into v_id;
  return jsonb_build_object('success',true,'session_id',v_id);
end; $$;

create or replace function public.close_cash_session(p_session_id uuid, p_actual_totals jsonb, p_closing_notes text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session public.cash_register_sessions%rowtype; v_expected jsonb; v_difference jsonb; begin
  select * into v_session from public.cash_register_sessions where id=p_session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not (public.has_role(auth.uid(),'super_admin') or exists(select 1 from public.profiles where id=auth.uid() and org_id=v_session.org_id and role in ('lab_admin','secretary'))) then raise exception 'CASH_PERMISSION_DENIED'; end if;
  select coalesce(jsonb_object_agg(currency, payload),'{}'::jsonb) into v_expected from (select currency, jsonb_build_object('total',sum(amount),'count',count(*),'by_method',coalesce(jsonb_object_agg(payment_method, method_total),'{}'::jsonb)) payload from (select currency,payment_method,sum(amount) method_total,count(*) method_count from public.payments where cash_session_id=p_session_id and not is_void group by currency,payment_method) methods group by currency) totals;
  select coalesce(jsonb_object_agg(key, jsonb_build_object('expected',coalesce((v_expected->key->>'total')::numeric,0),'actual',coalesce(value::numeric,0),'difference',coalesce(value::numeric,0)-coalesce((v_expected->key->>'total')::numeric,0))),'{}'::jsonb) into v_difference from jsonb_each_text(coalesce(p_actual_totals,'{}'::jsonb));
  update public.cash_register_sessions set status='closed',closed_at=now(),closed_by=auth.uid(),expected_totals=v_expected,actual_totals=coalesce(p_actual_totals,'{}'::jsonb),difference=v_difference,closing_notes=nullif(trim(coalesce(p_closing_notes,'')), '') where id=p_session_id;
  return jsonb_build_object('success',true,'expected',v_expected,'difference',v_difference);
end; $$;

-- Link every newly registered payment to the active cash session, when there is one.
create or replace function public.trg_fn_assign_open_cash_session() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.cash_session_id is null then select id into new.cash_session_id from public.cash_register_sessions where org_id=new.org_id and status='open'; end if; return new; end; $$;
create trigger trg_assign_open_cash_session before insert on public.payments for each row execute function public.trg_fn_assign_open_cash_session();
grant execute on function public.open_cash_session(uuid,numeric,numeric,text) to authenticated;
grant execute on function public.close_cash_session(uuid,jsonb,text) to authenticated;
