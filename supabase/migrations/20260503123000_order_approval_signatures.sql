alter type public.order_status add value if not exists 'por_aprobar';

alter table public.orders
  add column if not exists firma_url text,
  add column if not exists sello_url text;

alter table public.profiles
  add column if not exists firma_url text,
  add column if not exists sello_url text;

insert into storage.buckets (id, name, public)
values ('firms_stamps', 'firms_stamps', true)
on conflict (id) do update
set public = excluded.public;

create policy "Bioanalysts can upload own firms and stamps"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'firms_stamps'
  and public.has_role(auth.uid(), 'bioanalyst')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Bioanalysts can update own firms and stamps"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'firms_stamps'
  and public.has_role(auth.uid(), 'bioanalyst')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'firms_stamps'
  and public.has_role(auth.uid(), 'bioanalyst')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can read firms and stamps"
on storage.objects
as permissive
for select
to authenticated
using (bucket_id = 'firms_stamps');

create or replace function public.enforce_profile_signature_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
begin
  if auth.uid() is distinct from old.id then
    return new;
  end if;

  select role into current_role
  from public.profiles
  where id = auth.uid();

  if current_role = 'bioanalyst' then
    if new.id is distinct from old.id
      or new.org_id is distinct from old.org_id
      or new.role is distinct from old.role
      or new.full_name is distinct from old.full_name
      or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at then
      raise exception 'Bioanalyst solo puede actualizar firma y sello de su perfil';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_signature_updates on public.profiles;

create trigger trg_enforce_profile_signature_updates
before update on public.profiles
for each row
execute function public.enforce_profile_signature_updates();

create or replace function public.enforce_order_status_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
begin
  select role into current_role
  from public.profiles
  where id = auth.uid();

  if current_role in ('lab_admin', 'super_admin') then
    return new;
  end if;

  if current_role = 'secretary' then
    if new.status = 'por_aprobar'
      and old.status = 'pendiente'
      and new.completed_at is not distinct from old.completed_at
      and new.firma_url is not distinct from old.firma_url
      and new.sello_url is not distinct from old.sello_url then
      return new;
    end if;

    raise exception 'Secretaria solo puede pasar la orden de pendiente a por_aprobar';
  end if;

  if current_role = 'bioanalyst' then
    if new.status = 'por_aprobar'
      and old.status = 'pendiente'
      and new.completed_at is not distinct from old.completed_at
      and new.firma_url is not distinct from old.firma_url
      and new.sello_url is not distinct from old.sello_url then
      return new;
    end if;

    if new.status = 'completada'
      and old.status = 'por_aprobar'
      and new.completed_at is not null
      and new.firma_url is not null
      and new.sello_url is not null then
      return new;
    end if;

    raise exception 'Bioanalista solo puede pasar la orden a por_aprobar o completarla con firma y sello';
  end if;

  raise exception 'No tienes permisos para actualizar esta orden';
end;
$$;

drop trigger if exists trg_enforce_order_status_workflow on public.orders;

create trigger trg_enforce_order_status_workflow
before update on public.orders
for each row
when (old.status is distinct from new.status
  or old.completed_at is distinct from new.completed_at
  or old.firma_url is distinct from new.firma_url
  or old.sello_url is distinct from new.sello_url)
execute function public.enforce_order_status_workflow();
