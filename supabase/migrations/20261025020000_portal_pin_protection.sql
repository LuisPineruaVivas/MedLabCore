-- Improvement plan S-03: the patient portal PIN could be guessed without limit.
--
-- 1. portal_authenticate counts wrong PINs per document ID (stored as a SHA-256 hash).
--    After 10 failures within an hour that ID is refused with PORTAL_LOCKED until the
--    hour has passed, even with the right PIN. Other patients are not affected.
-- 2. New orders get a 10-character PIN from an alphabet without look-alike characters
--    (no 0/O, 1/I/L), made with a cryptographic generator. Existing 8-character PINs
--    keep working.

create table if not exists public.portal_login_attempts (
  id_number_hash text primary key,
  window_start timestamptz not null default now(),
  failures integer not null default 0
);

-- Only portal_authenticate (SECURITY DEFINER) touches this table.
alter table public.portal_login_attempts enable row level security;
revoke all on table public.portal_login_attempts from public, anon, authenticated;

create or replace function public.portal_authenticate(p_dni text, p_pin text)
returns table(patient_id uuid, first_name text, last_name text, id_number text, date_of_birth date, gender text, phone text, email text)
language plpgsql security definer set search_path = public as $$
declare
  v_key text := encode(sha256(convert_to(upper(trim(coalesce(p_dni, ''))), 'UTF8')), 'hex');
  v_attempts public.portal_login_attempts%rowtype;
begin
  select * into v_attempts from public.portal_login_attempts a where a.id_number_hash = v_key;
  -- Raised before any write, so nothing needs to survive the error.
  if found and v_attempts.failures >= 10 and v_attempts.window_start > now() - interval '1 hour' then
    raise exception 'PORTAL_LOCKED';
  end if;

  return query
  select pt.id, pt.first_name, pt.last_name, pt.id_number,
         pt.date_of_birth, pt.gender, pt.phone, pt.email
  from public.orders o
  inner join public.patients pt on pt.id = o.patient_id
  where upper(trim(pt.id_number)) = upper(trim(p_dni))
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  -- FOUND is true when RETURN QUERY returned a row. Wrong PINs are recorded with a
  -- normal return (no error), so the counter is committed.
  if found then
    delete from public.portal_login_attempts a where a.id_number_hash = v_key;
  else
    insert into public.portal_login_attempts as a (id_number_hash, window_start, failures)
    values (v_key, now(), 1)
    on conflict (id_number_hash) do update
      set failures = case when a.window_start <= now() - interval '1 hour' then 1 else a.failures + 1 end,
          window_start = case when a.window_start <= now() - interval '1 hour' then now() else a.window_start end;
  end if;
end;
$$;

create or replace function public.generate_order_access_pin()
returns trigger language plpgsql set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 characters
  v_pin text := '';
  v_byte integer;
begin
  while length(v_pin) < 10 loop
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    -- 248 = 31 * 8: rejecting 248..255 keeps every character equally likely.
    if v_byte < 248 then
      v_pin := v_pin || substr(v_alphabet, (v_byte % 31) + 1, 1);
    end if;
  end loop;
  new.access_pin := v_pin;
  return new;
end;
$$;
