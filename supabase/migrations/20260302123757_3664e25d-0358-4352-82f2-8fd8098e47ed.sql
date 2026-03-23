
CREATE TABLE public.test_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  schema JSONB NOT NULL DEFAULT '{"sections":[]}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
-- Super admins can do everything
CREATE POLICY "Super admins full access on test_templates"
  ON public.test_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Authenticated users can read global templates (org_id IS NULL)
CREATE POLICY "Users can read global templates"
  ON public.test_templates FOR SELECT TO authenticated
  USING (org_id IS NULL AND is_active = true);

-- Users can read their own org templates
CREATE POLICY "Users can read own org templates"
  ON public.test_templates FOR SELECT TO authenticated
  USING (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

-- Lab admins can insert templates for their org
CREATE POLICY "Lab admins can insert org templates"
  ON public.test_templates FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND public.has_role(auth.uid(), 'lab_admin')
  );

-- Lab admins can update their own org templates
CREATE POLICY "Lab admins can update org templates"
  ON public.test_templates FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND public.has_role(auth.uid(), 'lab_admin')
  )
  WITH CHECK (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND public.has_role(auth.uid(), 'lab_admin')
  );

-- Lab admins can delete their own org templates
CREATE POLICY "Lab admins can delete org templates"
  ON public.test_templates FOR DELETE TO authenticated
  USING (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND public.has_role(auth.uid(), 'lab_admin')
  );

-- Index for performance
CREATE INDEX idx_test_templates_org_id ON public.test_templates(org_id);
CREATE INDEX idx_test_templates_category ON public.test_templates(category);
