
-- ============================================================
-- SPRINT 1 FIX: Issue #8
-- Prevent users from updating their own 'role' field in profiles.
-- The RLS policy "Users can update own profile" allows updating
-- any column, including 'role', which could allow self-promotion.
--
-- Solution: A BEFORE UPDATE trigger that raises an exception if
-- a non-super-admin tries to change the 'role' column.
-- ============================================================

-- Function to block unauthorized role changes
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the 'role' column is being changed...
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only super_admins are allowed to change roles
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Permission denied: you cannot modify your own role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_prevent_role_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_update();
