
-- Allow super_admin to read all profiles
CREATE POLICY "Super admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::user_role));

-- Allow super_admin to manage all profiles
CREATE POLICY "Super admins can manage profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::user_role));
