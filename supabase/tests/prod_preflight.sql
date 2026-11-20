-- READ-ONLY production preflight. Changes nothing. Paste into Supabase > SQL Editor and run.
select 'migration history' as check, coalesce(string_agg(version, ', ' order by version), '(no history table rows)') as result
  from supabase_migrations.schema_migrations
union all select 'baseline objects: report_template col',  (exists (select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='report_template'))::text
union all select '0926 microbiology: antibiotics table',   (to_regclass('public.antibiotics') is not null)::text
union all select '0926 microbiology: test_templates.result_type', (exists (select 1 from information_schema.columns where table_schema='public' and table_name='test_templates' and column_name='result_type'))::text
union all select '1004 report_footer_text col',            (exists (select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='report_footer_text'))::text
union all select '1004 watermark_url col',                 (exists (select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='watermark_url'))::text
union all select '1005 has_erp_module col',                (exists (select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='has_erp_module'))::text
union all select '1005 bulk_upsert_org_prices fn',         (exists (select 1 from pg_proc where proname='bulk_upsert_org_prices'))::text
union all select 'ERP already present (invoices table)',   (to_regclass('public.invoices') is not null)::text
union all select 'HOLE: anon can run create_lab_order',    coalesce((select has_function_privilege('anon', p.oid, 'execute')::text from pg_proc p where proname='create_lab_order' limit 1), 'function missing')
union all select 'HOLE: profile-org guard trigger exists', (exists (select 1 from pg_trigger where tgname='trg_prevent_org_self_update'))::text
union all select 'own-profile update policy',              coalesce((select with_check from pg_policies where tablename='profiles' and policyname='Users can update own profile'), '(not found)')
union all select 'role guard trigger exists',              (exists (select 1 from pg_trigger where tgname='trg_prevent_role_self_update'))::text
union all select 'pg_cron available',                      (exists (select 1 from pg_available_extensions where name='pg_cron'))::text
union all select 'orgs total / with ERP on',               (select count(*)::text from public.organizations) || ' / ' || coalesce((select count(*)::text from public.organizations where (to_jsonb(organizations)->>'has_erp_module')::boolean), '0')
union all select 'postgres version',                       version();
