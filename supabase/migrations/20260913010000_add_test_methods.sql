-- Catalogo multitenant de metodos de analisis y su snapshot en cada resultado.

create table if not exists public.test_methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  id_global_ref uuid references public.test_methods(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_methods_org_id on public.test_methods(org_id);
create index if not exists idx_test_methods_global_ref on public.test_methods(id_global_ref);

-- Keep both the relation and a name snapshot. The snapshot keeps issued reports
-- historically accurate when a method is later renamed or removed.
alter table public.order_items
  add column if not exists test_method_id uuid references public.test_methods(id) on delete set null,
  add column if not exists method_name text;

alter table public.test_methods enable row level security;

drop policy if exists "Super admins full access on test_methods" on public.test_methods;
drop policy if exists "Users can read global test methods" on public.test_methods;
drop policy if exists "Users can read own org test methods" on public.test_methods;
drop policy if exists "Lab admins can insert org test methods" on public.test_methods;
drop policy if exists "Lab admins can update org test methods" on public.test_methods;
drop policy if exists "Lab admins can delete org test methods" on public.test_methods;

create policy "Super admins full access on test_methods"
on public.test_methods
for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'::public.user_role))
with check (public.has_role(auth.uid(), 'super_admin'::public.user_role));

create policy "Users can read global test methods"
on public.test_methods
for select to authenticated
using (org_id is null and is_active = true);

create policy "Users can read own org test methods"
on public.test_methods
for select to authenticated
using (org_id = public.get_my_org_id());

create policy "Lab admins can insert org test methods"
on public.test_methods
for insert to authenticated
with check (
  org_id = public.get_my_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'lab_admin'::public.user_role
  )
);

create policy "Lab admins can update org test methods"
on public.test_methods
for update to authenticated
using (
  org_id = public.get_my_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'lab_admin'::public.user_role
  )
)
with check (
  org_id = public.get_my_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'lab_admin'::public.user_role
  )
);

create policy "Lab admins can delete org test methods"
on public.test_methods
for delete to authenticated
using (
  org_id = public.get_my_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'lab_admin'::public.user_role
  )
);

grant all on table public.test_methods to authenticated, service_role;

-- The patient portal receives its items through this SECURITY DEFINER RPC,
-- therefore its payload must contain the stored method snapshot as well.
drop function if exists public.portal_get_patient_orders(uuid, text);

create or replace function public.portal_get_patient_orders(p_patient_id uuid, p_pin text)
returns table(
  order_id uuid,
  created_at timestamptz,
  status text,
  total_amount numeric,
  access_pin text,
  order_seq integer,
  org_name text,
  org_logo_url text,
  firma_url text,
  sello_url text,
  report_template text,
  department_order jsonb,
  items jsonb
)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_reference_date timestamptz;
begin
  select o.created_at into v_reference_date
  from public.orders o
  where o.patient_id = p_patient_id
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  if v_reference_date is null then return; end if;

  return query
  select o.id, o.created_at, o.status::text, o.total_amount, o.access_pin,
    o.order_seq, org.name::text, org.logo_url::text, o.firma_url::text,
    o.sello_url::text, coalesce(org.report_template::text, 'default'),
    coalesce((
      select jsonb_agg(category_settings.department_name order by category_settings.custom_sort_order, category_settings.department_name)
      from public.organization_test_category_settings category_settings
      where category_settings.org_id = o.org_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'order_id', oi.order_id, 'template_id', oi.template_id,
        'test_name', oi.test_name, 'price_at_order', oi.price_at_order,
        'results_data', oi.results_data, 'test_method_id', oi.test_method_id,
        'method_name', oi.method_name, 'created_at', oi.created_at,
        'parent_profile_id', oi.parent_profile_id, 'is_profile_header', oi.is_profile_header,
        'category', coalesce(tt.category, 'General'),
        'resolved_sort_order', coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999)
      ) order by coalesce(category_settings.custom_sort_order, 2147483647),
        coalesce(tt.category, 'General'), coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999),
        oi.created_at, oi.test_name)
      from public.order_items oi
      left join public.test_templates tt on tt.id = oi.template_id
      left join public.organization_exam_settings exam_settings on exam_settings.org_id = o.org_id and exam_settings.template_id = oi.template_id
      left join public.organization_test_category_settings category_settings on category_settings.org_id = o.org_id and category_settings.department_name = coalesce(tt.category, 'General')
      where oi.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  inner join public.organizations org on org.id = o.org_id
  where o.patient_id = p_patient_id and o.created_at <= v_reference_date
    and lower(o.status::text) = 'completada'
  order by o.created_at desc;
end;
$$;

grant all on function public.portal_get_patient_orders(uuid, text) to anon, authenticated, service_role;
