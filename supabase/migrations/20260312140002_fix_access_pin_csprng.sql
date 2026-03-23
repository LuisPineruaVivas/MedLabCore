
-- ============================================================
-- SPRINT 0 FIX: Issue #4
-- Replace weak md5(random()) PIN generation with
-- cryptographically secure gen_random_bytes.
-- Old: 6 hex chars from md5 (~16.7M combinations)
-- New: 8 hex chars from CSPRNG (~4.3B combinations)
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_access_pin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- We use gen_random_uuid() which is built into Postgres (no extension needed)
  -- and uses the OS CSPRNG to guarantee secure randomness.
  -- 8 uppercase hex characters → 4,294,967,296 possible values.
  NEW.access_pin := upper(substring(gen_random_uuid()::text from 1 for 8));
  RETURN NEW;
END;
$$;

-- Note: the trigger trg_generate_access_pin already exists from the previous migration,
-- so no need to recreate it. The function replacement above takes effect immediately.
