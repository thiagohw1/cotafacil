CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_tenant_id BIGINT;
  user_role public.app_role;
  meta_tenant_id BIGINT;
BEGIN
  -- Check if tenant_id is provided in metadata
  meta_tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::BIGINT;
  
  -- If tenant_id is provided, use it
  IF meta_tenant_id IS NOT NULL THEN
    new_tenant_id := meta_tenant_id;
    -- Get role from metadata or default to buyer
    user_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'buyer'::public.app_role);
  ELSE
    -- Original logic: Create a new tenant for the user
    INSERT INTO public.tenants (name, slug, created_by)
    VALUES (
      COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
      LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'empresa-' || LEFT(NEW.id::text, 8)), ' ', '-')),
      NEW.id
    )
    RETURNING id INTO new_tenant_id;
    
    -- Default role for new tenant owner is admin
    user_role := 'admin'::public.app_role;
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, tenant_id, email, full_name)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;
