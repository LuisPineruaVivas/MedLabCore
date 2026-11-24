-- Test for migration 20261123010000_org_slug. Rolled back.
--   npm run test:db -- org_slug
-- New labs get a slug from their name (accents removed, repeats numbered), a rename keeps it,
-- an admin can set a valid unique one, and anon can read the branding by slug.
-- Prints "Org slug passed".

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

create function pg_temp.assert_eq(p_actual text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Assertion failed: % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
end;
$$;

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-00000000b001', 'Laboratorio Clínico Slugtest, C.A.'),
  ('00000000-0000-0000-0000-00000000b002', 'Laboratorio Clínico Slugtest, C.A.'),
  ('00000000-0000-0000-0000-00000000b003', '!!!');

select pg_temp.assert_eq((select slug from public.organizations where id = '00000000-0000-0000-0000-00000000b001'),
  'laboratorio-clinico-slugtest-c-a', 'slug from name');
select pg_temp.assert_eq((select slug from public.organizations where id = '00000000-0000-0000-0000-00000000b002'),
  'laboratorio-clinico-slugtest-c-a-2', 'repeated name is numbered');
select pg_temp.assert_eq(left((select slug from public.organizations where id = '00000000-0000-0000-0000-00000000b003'), 3),
  'lab', 'name without letters falls back to lab');

-- Renaming keeps the slug (links already sent keep working).
update public.organizations set name = 'Otro Nombre' where id = '00000000-0000-0000-0000-00000000b001';
select pg_temp.assert_eq((select slug from public.organizations where id = '00000000-0000-0000-0000-00000000b001'),
  'laboratorio-clinico-slugtest-c-a', 'rename keeps slug');

-- An admin can set a valid slug (normalized to lower case); invalid or taken ones are refused.
update public.organizations set slug = ' Slugtest-Rivalta ' where id = '00000000-0000-0000-0000-00000000b001';
select pg_temp.assert_eq((select slug from public.organizations where id = '00000000-0000-0000-0000-00000000b001'),
  'slugtest-rivalta', 'custom slug');
select pg_temp.expect_error(
  $q$update public.organizations set slug = 'con espacios' where id = '00000000-0000-0000-0000-00000000b002'$q$,
  'organizations_slug_format');
select pg_temp.expect_error(
  $q$update public.organizations set slug = 'slugtest-rivalta' where id = '00000000-0000-0000-0000-00000000b002'$q$,
  'organizations_slug_key');

-- Anon reads the branding by slug, and nothing for an unknown slug.
set local role anon;
select pg_temp.assert_eq((select name from public.get_public_org_brand_by_slug('SlugTest-Rivalta')), 'Otro Nombre', 'brand by slug');
select pg_temp.assert_eq((select count(*)::text from public.get_public_org_brand_by_slug('no-existe-slugtest')), '0', 'unknown slug');
reset role;

do $$ begin raise notice 'Org slug passed'; end $$;

rollback;
