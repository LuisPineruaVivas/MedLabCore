ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_pin text DEFAULT NULL;

-- Create function to auto-generate access_pin on insert
CREATE OR REPLACE FUNCTION public.generate_order_access_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.access_pin := upper(substr(md5(random()::text), 1, 6));
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_access_pin ON public.orders;
CREATE TRIGGER trg_generate_access_pin
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_access_pin();

-- Add RLS policy for anonymous access to orders via access_pin (for patient portal)
CREATE POLICY "Public can read orders by access_pin"
  ON public.orders
  FOR SELECT
  TO anon
  USING (access_pin IS NOT NULL);

-- Add RLS policy for anonymous access to order_items via order
CREATE POLICY "Public can read order_items for accessible orders"
  ON public.order_items
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.access_pin IS NOT NULL
  ));

-- Allow anon to read patients for portal
CREATE POLICY "Public can read patients for portal"
  ON public.patients
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read organizations for portal PDF
CREATE POLICY "Public can read organizations for portal"
  ON public.organizations
  FOR SELECT
  TO anon
  USING (true);