-- Create the user_roles table that has_role() and handle_new_user() depend on
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'secretary',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: super_admins can manage all roles
CREATE POLICY "Super admins can manage user_roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::user_role));

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Seed: copy existing roles from profiles into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT DO NOTHING;