create table if not exists public.organization_test_category_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_name text not null,
  custom_sort_order integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organization_test_category_settings_org_id_department_name_key unique (org_id, department_name)
);

create index if not exists idx_org_test_category_settings_org_id
  on public.organization_test_category_settings using btree (org_id);

create index if not exists idx_org_test_category_settings_sort_order
  on public.organization_test_category_settings using btree (org_id, custom_sort_order);

create trigger trg_organization_test_category_settings_updated_at
before update on public.organization_test_category_settings
for each row
execute function public.handle_updated_at();

alter table public.organization_test_category_settings enable row level security;

grant all on table public.organization_test_category_settings to anon;
grant all on table public.organization_test_category_settings to authenticated;
grant all on table public.organization_test_category_settings to service_role;

create policy "Users can read department order in their org"
on public.organization_test_category_settings
for select
to authenticated
using (
  org_id = (
    select p.org_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

create policy "Lab admins can manage department order"
on public.organization_test_category_settings
to authenticated
using (
  org_id = (
    select p.org_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and (
    public.has_role(auth.uid(), 'lab_admin'::public.user_role)
    or public.has_role(auth.uid(), 'super_admin'::public.user_role)
  )
)
with check (
  org_id = (
    select p.org_id
    from public.profiles p
    where p.id = auth.uid()
  )
  and (
    public.has_role(auth.uid(), 'lab_admin'::public.user_role)
    or public.has_role(auth.uid(), 'super_admin'::public.user_role)
  )
);
