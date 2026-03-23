
-- 1. Create exchange_rates table
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rate numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(org_id)
);

-- RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can read
CREATE POLICY "Users can read own org exchange rate"
  ON public.exchange_rates FOR SELECT
  USING (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

-- Lab admins can manage
CREATE POLICY "Lab admins can manage exchange rates"
  ON public.exchange_rates FOR ALL
  USING (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(), 'lab_admin') OR has_role(auth.uid(), 'super_admin'))
  );

-- Public read for portal
CREATE POLICY "Public can read exchange rates"
  ON public.exchange_rates FOR SELECT
  USING (true);

-- 2. Add columns to orders
ALTER TABLE public.orders
  ADD COLUMN exchange_rate numeric DEFAULT NULL,
  ADD COLUMN total_bs numeric DEFAULT NULL;
