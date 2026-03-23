
-- Create the handle_updated_at function first
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create enums
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  status order_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.test_templates(id),
  test_name text NOT NULL,
  price_at_order numeric NOT NULL DEFAULT 0,
  results_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS for orders
CREATE POLICY "Users can read orders in their org"
  ON public.orders FOR SELECT
  USING (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Users can insert orders in their org"
  ON public.orders FOR INSERT
  WITH CHECK (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Users can update orders in their org"
  ON public.orders FOR UPDATE
  USING (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Super admins full access on orders"
  ON public.orders FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS for order_items
CREATE POLICY "Users can read order_items in their org"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
  ));

CREATE POLICY "Users can insert order_items in their org"
  ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
  ));

CREATE POLICY "Users can update order_items in their org"
  ON public.order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
    AND o.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
  ));

CREATE POLICY "Super admins full access on order_items"
  ON public.order_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at on orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
