-- ============================================================
-- Migration: Exam Profiles (Combos)
-- ============================================================

-- 1. Create exam_profiles table
CREATE TABLE public.exam_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create junction table: profile <-> test_templates
CREATE TABLE public.profile_templates_junction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.exam_profiles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.test_templates(id) ON DELETE CASCADE,
  UNIQUE(profile_id, template_id)
);

-- 3. Alter order_items: add profile columns + make template_id nullable
ALTER TABLE public.order_items
  ADD COLUMN parent_profile_id uuid DEFAULT NULL,
  ADD COLUMN is_profile_header boolean NOT NULL DEFAULT false;

ALTER TABLE public.order_items
  ALTER COLUMN template_id DROP NOT NULL;

-- ============================================================
-- RLS for exam_profiles
-- ============================================================
ALTER TABLE public.exam_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read exam_profiles in their org"
  ON public.exam_profiles FOR SELECT
  USING (org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Lab admins can manage exam_profiles"
  ON public.exam_profiles FOR ALL
  USING (
    org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(), 'lab_admin') OR has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Super admins full access on exam_profiles"
  ON public.exam_profiles FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- RLS for profile_templates_junction
-- ============================================================
ALTER TABLE public.profile_templates_junction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read profile_templates_junction in their org"
  ON public.profile_templates_junction FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exam_profiles ep
    WHERE ep.id = profile_id
    AND ep.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
  ));

CREATE POLICY "Lab admins can manage profile_templates_junction"
  ON public.profile_templates_junction FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exam_profiles ep
    WHERE ep.id = profile_id
    AND ep.org_id = (SELECT p.org_id FROM profiles p WHERE p.id = auth.uid())
    AND (has_role(auth.uid(), 'lab_admin') OR has_role(auth.uid(), 'super_admin'))
  ));

CREATE POLICY "Super admins full access on profile_templates_junction"
  ON public.profile_templates_junction FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));
