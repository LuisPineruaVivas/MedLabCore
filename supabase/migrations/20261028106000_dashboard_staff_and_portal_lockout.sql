-- Security audit run-2, two lows (and one needs-validation lead closed in passing):
--
-- 1. rpc/get_dashboard_summary+get_dashboard_top_tests/assert_org_member-no-role-binding-lab_affiliate
--    assert_org_member checked org membership only, so a lab_affiliate (an external
--    referring partner) read lab-wide revenue, order/patient counts and top tests. The
--    dashboard RPCs (its only callers) now require a staff role, like the /dashboard route.
--
-- 2. ...portal_authenticate:dni-only-hard-lockout
--    Ten wrong PINs per document ID locked that ID for an hour in every lab, so anyone
--    knowing a cedula could lock a patient out. The hard lock is now counted per
--    (document ID, client address). A much higher per-ID backstop (100 per hour, any
--    client) still stops distributed guessing. Expired counter rows are pruned.
--    The client address comes from the cf-connecting-ip header (set by the hosted
--    proxy), else the last x-forwarded-for entry; without either, all calls share one
--    bucket per ID (the old behavior). Which header the hosted stack sets is a
--    deployment fact to confirm at release.
--
-- 3. ...portal_authenticate:read-only-transaction-lockout-bypass (needs validation)
--    A read-only (GET) call skipped the counter and leaked whether the PIN was right
--    through different error texts. The function now refuses read-only execution up
--    front with one generic error.

create or replace function public.assert_org_member(p_org_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not (
       public.has_role(auth.uid(), 'super_admin')
       or (p_org_id = public.get_my_org_id() and public.get_my_role() in ('lab_admin', 'bioanalyst', 'secretary'))
     ) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.portal_client_key()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(trim(h->>'cf-connecting-ip'), ''),
    nullif(trim(reverse(split_part(reverse(coalesce(h->>'x-forwarded-for', '')), ',', 1))), ''),
    'unknown')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) headers
$$;

revoke execute on function public.portal_client_key() from public, anon, authenticated;

create or replace function public.portal_authenticate(p_dni text, p_pin text)
returns table(patient_id uuid, first_name text, last_name text, id_number text, date_of_birth date, gender text, phone text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dni text := upper(trim(coalesce(p_dni, '')));
  v_key_client text := encode(sha256(convert_to(v_dni || '|' || public.portal_client_key(), 'UTF8')), 'hex');
  v_key_id text := encode(sha256(convert_to(v_dni, 'UTF8')), 'hex');
begin
  -- Every attempt must be recorded; a read-only (GET) call cannot record it.
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'PORTAL_UNAVAILABLE';
  end if;

  -- Raised before any write, so nothing needs to survive the error.
  if exists (select 1 from public.portal_login_attempts a
             where a.id_number_hash = v_key_client and a.failures >= 10 and a.window_start > now() - interval '1 hour')
     or exists (select 1 from public.portal_login_attempts a
                where a.id_number_hash = v_key_id and a.failures >= 100 and a.window_start > now() - interval '1 hour') then
    raise exception 'PORTAL_LOCKED';
  end if;

  return query
  select pt.id, pt.first_name, pt.last_name, pt.id_number,
         pt.date_of_birth, pt.gender, pt.phone, pt.email
  from public.orders o
  inner join public.patients pt on pt.id = o.patient_id
  where upper(trim(pt.id_number)) = v_dni
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  -- FOUND is true when RETURN QUERY returned a row. Wrong PINs are recorded with a
  -- normal return (no error), so the counters are committed.
  if found then
    delete from public.portal_login_attempts a where a.id_number_hash in (v_key_client, v_key_id);
  else
    insert into public.portal_login_attempts as a (id_number_hash, window_start, failures)
    values (v_key_client, now(), 1), (v_key_id, now(), 1)
    on conflict (id_number_hash) do update
      set failures = case when a.window_start <= now() - interval '1 hour' then 1 else a.failures + 1 end,
          window_start = case when a.window_start <= now() - interval '1 hour' then now() else a.window_start end;
    -- Keep the table bounded: drop a batch of long-expired rows.
    delete from public.portal_login_attempts a
    where a.id_number_hash in (select b.id_number_hash from public.portal_login_attempts b
                               where b.window_start < now() - interval '1 day' limit 100);
  end if;
end;
$$;
