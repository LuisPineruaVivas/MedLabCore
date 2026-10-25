-- Storage ownership rules for the `logos` and `firms_stamps` buckets.
--
-- Until now these policies lived only in the dashboard and checked nothing but
-- the bucket: any signed-in user of any lab could upload into, or overwrite,
-- another lab's logo/watermark (shown on that lab's reports and patient
-- portal), and upload into another user's signature folder. There were no
-- DELETE policies, so removing a signature or stamp in the app silently left
-- the file behind.
--
-- Paths are built by the app as:
--   logos:        <org_id>/logo-<ts>.<ext>, <org_id>/watermark-<ts>.<ext>
--   firms_stamps: <user_id>/firma-<ts>.<ext>, <user_id>/sello-<ts>.<ext>
--
-- New rules (reads are unchanged):
--   logos        write/replace/delete: lab_admin of the org named by the first
--                folder, or super_admin.
--   firms_stamps write/replace/delete: only the user named by the first folder.

-- ---------------------------------------------------------------------------
-- logos
-- ---------------------------------------------------------------------------
drop policy if exists "Usuarios autenticados pueden subir logos 1peuqw_0" on storage.objects;
drop policy if exists "Usuarios autenticados pueden subir logos 1peuqw_2" on storage.objects;
drop policy if exists "Lab admins upload own org logos" on storage.objects;
drop policy if exists "Lab admins replace own org logos" on storage.objects;
drop policy if exists "Lab admins delete own org logos" on storage.objects;

create policy "Lab admins upload own org logos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      public.has_role(auth.uid(), 'super_admin')
      or (
        (storage.foldername(name))[1] = public.get_my_org_id()::text
        and public.get_my_role() = 'lab_admin'
      )
    )
  );

create policy "Lab admins replace own org logos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.has_role(auth.uid(), 'super_admin')
      or (
        (storage.foldername(name))[1] = public.get_my_org_id()::text
        and public.get_my_role() = 'lab_admin'
      )
    )
  )
  with check (
    bucket_id = 'logos'
    and (
      public.has_role(auth.uid(), 'super_admin')
      or (
        (storage.foldername(name))[1] = public.get_my_org_id()::text
        and public.get_my_role() = 'lab_admin'
      )
    )
  );

create policy "Lab admins delete own org logos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.has_role(auth.uid(), 'super_admin')
      or (
        (storage.foldername(name))[1] = public.get_my_org_id()::text
        and public.get_my_role() = 'lab_admin'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- firms_stamps (signatures and stamps)
-- ---------------------------------------------------------------------------
drop policy if exists "Usuarios autenticados pueden subir firmas" on storage.objects;
drop policy if exists "Users upload own signature files" on storage.objects;
drop policy if exists "Users replace own signature files" on storage.objects;
drop policy if exists "Users delete own signature files" on storage.objects;

create policy "Users upload own signature files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'firms_stamps'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users replace own signature files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'firms_stamps'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'firms_stamps'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own signature files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'firms_stamps'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The two existing SELECT policies ("Usuarios autenticados pueden subir logos
-- 1peuqw_1" and "Usuarios autenticados pueden ver firmas") are kept: reports,
-- the portal and PDFs read these files, and upsert uploads need SELECT.
