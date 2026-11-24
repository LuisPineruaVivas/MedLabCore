-- Short public name of each lab for patient links (?lab=laboratorio-rivalta instead of ?org=<uuid>).
-- Generated from the name when the lab is created; it does not follow later renames so links
-- already sent keep working. A lab admin may change it (old ?lab= links then stop loading the brand).

alter table public.organizations add column if not exists slug text;

-- "Laboratorio Clínico Rivalta, C.A." -> "laboratorio-clinico-rivalta-c-a"
create or replace function public.org_slug_base(p_name text)
returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_name, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', '-', 'g')), 50), ''), 'lab')
$$;

-- First free slug: base, base-2, base-3...
create or replace function public.org_unique_slug(p_base text, p_org_id uuid)
returns text language plpgsql stable set search_path = public as $$
declare
  v_slug text := trim(both '-' from p_base);
  v_n int := 1;
begin
  while exists (select 1 from public.organizations where slug = v_slug and id is distinct from p_org_id) loop
    v_n := v_n + 1;
    v_slug := trim(both '-' from p_base) || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.organizations_set_slug()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.org_unique_slug(public.org_slug_base(new.name), new.id);
  else
    new.slug := lower(btrim(new.slug));
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_set_slug on public.organizations;
create trigger organizations_set_slug
  before insert or update of slug on public.organizations
  for each row execute function public.organizations_set_slug();

-- Backfill existing labs, oldest first so the oldest keeps the plain name.
do $$
declare r record;
begin
  for r in select id, name from public.organizations where slug is null order by created_at nulls last, id loop
    update public.organizations set slug = public.org_unique_slug(public.org_slug_base(r.name), r.id) where id = r.id;
  end loop;
end $$;

alter table public.organizations alter column slug set not null;
alter table public.organizations
  add constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60);
create unique index if not exists organizations_slug_key on public.organizations (slug);

-- Same branding as get_public_org_brand, looked up by slug.
create or replace function public.get_public_org_brand_by_slug(p_slug text)
returns table(name text, logo_url text, primary_color text, secondary_color text, email text, phone text, address text, report_template text)
language sql stable security definer set search_path = public as $$
  select o.name, o.logo_url, o.primary_color, o.secondary_color, o.email, o.phone, o.address, o.report_template
  from public.organizations o
  where o.slug = lower(btrim(p_slug))
$$;

revoke execute on function public.get_public_org_brand_by_slug(text) from public;
grant execute on function public.get_public_org_brand_by_slug(text) to anon, authenticated, service_role;
