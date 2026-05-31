-- Corregimos la función local para que sea SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::public.user_role, 
    'secretary'::public.user_role
  );

  INSERT INTO public.profiles (id, full_name, org_id, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    (NEW.raw_user_meta_data ->> 'org_id')::uuid,
    NEW.email,
    v_role
  );
  
  RETURN NEW;
END;
$$;

-- Creamos el trigger que amarra Auth con Profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();