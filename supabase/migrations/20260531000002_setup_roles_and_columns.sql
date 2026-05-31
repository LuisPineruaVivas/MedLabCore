-- 1. ACTUALIZACIÓN DE ENUMS
do $$
begin
  alter type public.user_role add value if not exists 'lab_affiliate';
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter type public.payment_status add value if not exists 'pending';
exception
  when duplicate_object then null;
end
$$;

-- 2. ADICIÓN DE COLUMNAS TEMPORALES (CON VALOR DEFAULT)
alter table public.patients
add column if not exists created_by uuid default auth.uid();

alter table public.orders
add column if not exists created_by uuid default auth.uid();

-- 3. MIGRACIÓN Y RELLENO DE REGISTROS EXISTENTES
update public.patients p
set created_by = (
  select pr.id
  from public.profiles pr
  where pr.org_id = p.org_id
  order by
    case pr.role
      when 'lab_admin' then 1
      when 'super_admin' then 2
      when 'secretary' then 3
      when 'bioanalyst' then 4
      else 5
    end,
    pr.created_at nulls last
  limit 1
)
where p.created_by is null;

update public.orders o
set created_by = (
  select pr.id
  from public.profiles pr
  where pr.org_id = o.org_id
  order by
    case pr.role
      when 'lab_admin' then 1
      when 'super_admin' then 2
      when 'secretary' then 3
      when 'bioanalyst' then 4
      else 5
    end,
    pr.created_at nulls last
  limit 1
)
where o.created_by is null;

-- 4. RESTRICCIONES NOT NULL Y VALORES POR DEFECTO DEFINITIVOS
alter table public.patients
alter column created_by set default auth.uid();

alter table public.orders
alter column created_by set default auth.uid();

alter table public.patients
alter column created_by set not null;

alter table public.orders
alter column created_by set not null;

-- 5. LLAVES FORÁNEAS
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_created_by_fkey'
  ) then
    alter table public.patients
    add constraint patients_created_by_fkey
    foreign key (created_by) references auth.users(id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_created_by_fkey'
  ) then
    alter table public.orders
    add constraint orders_created_by_fkey
    foreign key (created_by) references auth.users(id);
  end if;
end
$$;

-- 6. ÍNDICES
create index if not exists idx_patients_created_by on public.patients (created_by);
create index if not exists idx_orders_created_by on public.orders (created_by);
create index if not exists idx_orders_created_by_payment_status on public.orders (created_by, payment_status);