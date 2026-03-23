
-- ============================================================
-- SPRINT 0 FIX: Issues #2 + #3
-- Removes overly permissive anonymous RLS policies and replaces
-- direct table access with a secure SECURITY DEFINER RPC function.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. DROP insecure anonymous policies on patients
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read patients for portal" ON public.patients;

-- ----------------------------------------------------------------
-- 2. DROP insecure anonymous policies on orders
--    (USING (access_pin IS NOT NULL) exposes ALL orders to anon)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read orders by access_pin" ON public.orders;

-- ----------------------------------------------------------------
-- 3. DROP insecure anonymous policies on order_items
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read order_items for accessible orders" ON public.order_items;

-- ----------------------------------------------------------------
-- 4. DROP insecure anonymous policies on organizations
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read organizations for portal" ON public.organizations;

-- ----------------------------------------------------------------
-- 5. Secure RPC for portal authentication (STEP 1: authenticate)
--
-- Receives the patient's ID number (DNI) and the order access_pin.
-- Returns the patient session data only if both match an existing order.
-- Callable by anon role — does NOT expose raw table data.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_authenticate(p_dni text, p_pin text)
RETURNS TABLE (
  patient_id        uuid,
  first_name        text,
  last_name         text,
  id_number         text,
  date_of_birth     date,
  gender            text,
  phone             text,
  email             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id,
    pt.first_name,
    pt.last_name,
    pt.id_number,
    pt.date_of_birth,
    pt.gender,
    pt.phone,
    pt.email
  FROM public.orders o
  INNER JOIN public.patients pt ON pt.id = o.patient_id
  WHERE
    upper(trim(pt.id_number))  = upper(trim(p_dni))
    AND upper(trim(o.access_pin)) = upper(trim(p_pin))
  LIMIT 1;
END;
$$;

-- ----------------------------------------------------------------
-- 6. Secure RPC to fetch all completed orders for a patient
--    (STEP 2: load history after authentication)
--
-- Takes a patient_id (trusted client-side after successful auth).
-- Returns completed orders with org info and items as JSON.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_get_patient_orders(p_patient_id uuid)
RETURNS TABLE (
  order_id        uuid,
  created_at      timestamptz,
  status          text,
  total_amount    numeric,
  access_pin      text,
  org_name        text,
  org_logo_url    text,
  items           jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.created_at,
    o.status::text,
    o.total_amount,
    o.access_pin,
    org.name::text,
    org.logo_url::text,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',           oi.id,
          'test_name',    oi.test_name,
          'price_at_order', oi.price_at_order,
          'results_data', oi.results_data,
          'created_at',   oi.created_at,
          'category',     tt.category
        )
        ORDER BY oi.created_at
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM public.orders o
  INNER JOIN public.organizations org ON org.id = o.org_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.test_templates tt ON tt.id = oi.template_id
  WHERE
    o.patient_id = p_patient_id
    AND o.status = 'completada'
  GROUP BY o.id, o.created_at, o.status, o.total_amount, o.access_pin, org.name, org.logo_url
  ORDER BY o.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------
-- 7. Grant EXECUTE to anon role so the portal can call these RPCs
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.portal_authenticate(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_get_patient_orders(uuid) TO anon;
