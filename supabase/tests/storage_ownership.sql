-- Regression test for migration 20261024000000_storage_object_ownership.
-- Replays the cross-lab / cross-user storage writes that the old dashboard
-- policies allowed and checks they now fail, next to the legitimate uploads,
-- replacements, deletes and reads that must keep working. Runs inside a
-- transaction and rolls back, so it leaves no data behind:
--   docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/storage_ownership.sql
-- (prepend the migrations if they are not applied yet). Prints "Storage ownership passed".

begin;

create function pg_temp.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'Expected error matching "%" but statement succeeded: %', p_pattern, p_sql;
exception when others then
  if sqlerrm not like '%' || p_pattern || '%' then
    raise exception 'Expected error matching "%" but got "%" for: %', p_pattern, sqlerrm, p_sql;
  end if;
end;
$$;

create function pg_temp.assert_eq(p_actual numeric, p_expected numeric, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'Assertion failed (%): expected %, got %', p_label, p_expected, p_actual;
  end if;
end;
$$;

-- Rows touched by an UPDATE/DELETE (0 when RLS hides the row).
create function pg_temp.rows(p_sql text) returns integer language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- The Storage API sets this flag before deleting rows; direct SQL deletes are
-- otherwise blocked by storage.protect_delete.
select set_config('storage.allow_delete_query', 'true', true);

-- ---------------------------------------------------------------------------
-- Production read policies (created in the dashboard, kept by the migration).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Usuarios autenticados pueden subir logos 1peuqw_1') then
    create policy "Usuarios autenticados pueden subir logos 1peuqw_1" on storage.objects
      for select to authenticated using (bucket_id = 'logos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Usuarios autenticados pueden ver firmas') then
    create policy "Usuarios autenticados pueden ver firmas" on storage.objects
      for select to authenticated using (bucket_id = 'firms_stamps');
  end if;
end $$;

-- Static: the permissive write policies are gone, the scoped ones exist.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in (
      'Usuarios autenticados pueden subir firmas',
      'Usuarios autenticados pueden subir logos 1peuqw_0',
      'Usuarios autenticados pueden subir logos 1peuqw_2')) then
    raise exception 'old bucket-only write policies still present';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in (
      'Lab admins upload own org logos', 'Lab admins replace own org logos', 'Lab admins delete own org logos',
      'Users upload own signature files', 'Users replace own signature files', 'Users delete own signature files')) <> 6 then
    raise exception 'scoped storage policies missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures: labs A and B, staff in each, a super admin, existing files.
-- ---------------------------------------------------------------------------
create temp table ids (k text primary key, v uuid);
insert into ids values
  ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()),
  ('adminA', gen_random_uuid()), ('secA', gen_random_uuid()), ('bioA', gen_random_uuid()),
  ('adminB', gen_random_uuid()), ('bioB', gen_random_uuid()), ('superAdmin', gen_random_uuid());
grant select on ids to authenticated;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ids where k = p_key $$;

insert into storage.buckets (id, name, public) values ('logos', 'logos', true), ('firms_stamps', 'firms_stamps', true)
on conflict (id) do nothing;

insert into public.organizations (id, name) values
  (pg_temp.id('orgA'), 'Storage Test A'), (pg_temp.id('orgB'), 'Storage Test B');

insert into auth.users (id, email)
select v, k || '@storage-test.local' from ids where k not in ('orgA', 'orgB');

insert into public.profiles (id, org_id, role, full_name, email) values
  (pg_temp.id('adminA'), pg_temp.id('orgA'), 'lab_admin', 'Admin A', 'adminA@storage-test.local'),
  (pg_temp.id('secA'), pg_temp.id('orgA'), 'secretary', 'Secretaria A', 'secA@storage-test.local'),
  (pg_temp.id('bioA'), pg_temp.id('orgA'), 'bioanalyst', 'Bio A', 'bioA@storage-test.local'),
  (pg_temp.id('adminB'), pg_temp.id('orgB'), 'lab_admin', 'Admin B', 'adminB@storage-test.local'),
  (pg_temp.id('bioB'), pg_temp.id('orgB'), 'bioanalyst', 'Bio B', 'bioB@storage-test.local'),
  (pg_temp.id('superAdmin'), null, 'super_admin', 'Super Admin', 'super@storage-test.local')
on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;

insert into public.user_roles (user_id, role) values
  (pg_temp.id('adminA'), 'lab_admin'), (pg_temp.id('secA'), 'secretary'), (pg_temp.id('bioA'), 'bioanalyst'),
  (pg_temp.id('adminB'), 'lab_admin'), (pg_temp.id('bioB'), 'bioanalyst'), (pg_temp.id('superAdmin'), 'super_admin')
on conflict do nothing;

insert into storage.objects (bucket_id, name) values
  ('logos', pg_temp.id('orgA') || '/logo-1.png'),
  ('logos', pg_temp.id('orgB') || '/logo-1.png'),
  ('logos', pg_temp.id('orgB') || '/watermark-1.png'),
  ('firms_stamps', pg_temp.id('bioA') || '/firma-1.png'),
  ('firms_stamps', pg_temp.id('bioB') || '/firma-1.png');

-- ===========================================================================
-- logos: only a lab_admin of the folder's org (or super_admin) writes.
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('adminA'));
insert into storage.objects (bucket_id, name) values ('logos', pg_temp.id('orgA') || '/logo-2.png');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  'logos', pg_temp.id('orgB') || '/logo-2.png'), 'row-level security');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'logos', pg_temp.id('orgB') || '/logo-1.png')), 0, 'admin A cannot replace lab B logo');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'logos', pg_temp.id('orgB') || '/watermark-1.png')), 0, 'admin A cannot replace lab B watermark');
select pg_temp.assert_eq(pg_temp.rows(format('delete from storage.objects where bucket_id = %L and name = %L',
  'logos', pg_temp.id('orgB') || '/logo-1.png')), 0, 'admin A cannot delete lab B logo');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'logos', pg_temp.id('orgA') || '/logo-1.png')), 1, 'admin A replaces own logo');
select pg_temp.assert_eq(pg_temp.rows(format('delete from storage.objects where bucket_id = %L and name = %L',
  'logos', pg_temp.id('orgA') || '/logo-1.png')), 1, 'admin A deletes own logo');
select pg_temp.assert_eq((select count(*) from storage.objects where bucket_id = 'logos' and name = pg_temp.id('orgB') || '/logo-1.png'),
  1, 'admin A still reads lab B logo');

select pg_temp.act_as(pg_temp.id('secA'));
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  'logos', pg_temp.id('orgA') || '/logo-3.png'), 'row-level security');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'logos', pg_temp.id('orgA') || '/logo-2.png')), 0, 'secretary cannot replace own lab logo');

select pg_temp.act_as(pg_temp.id('superAdmin'));
insert into storage.objects (bucket_id, name) values ('logos', pg_temp.id('orgB') || '/logo-9.png');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'logos', pg_temp.id('orgB') || '/logo-1.png')), 1, 'super admin replaces any lab logo');
reset role;
rollback to savepoint s;

-- ===========================================================================
-- firms_stamps: each user writes only inside their own folder.
-- ===========================================================================
savepoint s;
select pg_temp.act_as(pg_temp.id('bioA'));
insert into storage.objects (bucket_id, name) values ('firms_stamps', pg_temp.id('bioA') || '/sello-2.png');
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  'firms_stamps', pg_temp.id('bioB') || '/firma-2.png'), 'row-level security');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'firms_stamps', pg_temp.id('bioB') || '/firma-1.png')), 0, 'bio A cannot replace bio B signature');
select pg_temp.assert_eq(pg_temp.rows(format('delete from storage.objects where bucket_id = %L and name = %L',
  'firms_stamps', pg_temp.id('bioB') || '/firma-1.png')), 0, 'bio A cannot delete bio B signature');
select pg_temp.assert_eq(pg_temp.rows(format('update storage.objects set metadata = %L where bucket_id = %L and name = %L',
  '{"x":1}', 'firms_stamps', pg_temp.id('bioA') || '/firma-1.png')), 1, 'bio A replaces own signature');
select pg_temp.assert_eq(pg_temp.rows(format('delete from storage.objects where bucket_id = %L and name = %L',
  'firms_stamps', pg_temp.id('bioA') || '/firma-1.png')), 1, 'bio A deletes own signature');
select pg_temp.assert_eq((select count(*) from storage.objects where bucket_id = 'firms_stamps' and name = pg_temp.id('bioB') || '/firma-1.png'),
  1, 'bio A still reads bio B signature');

-- A lab admin cannot write into a staff member's signature folder either.
select pg_temp.act_as(pg_temp.id('adminA'));
select pg_temp.expect_error(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  'firms_stamps', pg_temp.id('bioA') || '/firma-3.png'), 'row-level security');
reset role;
rollback to savepoint s;

do $$ begin raise notice 'Storage ownership passed'; end $$;

rollback;
