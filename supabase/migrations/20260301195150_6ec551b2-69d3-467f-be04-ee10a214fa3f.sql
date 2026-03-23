
CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  id_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  phone text,
  email text,
  address text,
  occupation text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique id_number per org
ALTER TABLE public.patients ADD CONSTRAINT patients_id_number_org_unique UNIQUE (org_id, id_number);

-- RLS policies
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read patients in their org"
  ON public.patients FOR SELECT
  USING (
    org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Users can insert patients in their org"
  ON public.patients FOR INSERT
  WITH CHECK (
    org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Users can update patients in their org"
  ON public.patients FOR UPDATE
  USING (
    org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Super admins can manage all patients"
  ON public.patients FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::user_role));
