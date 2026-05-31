CREATE OR REPLACE FUNCTION public.get_next_order_seq()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Busca el número máximo del mes actual para esa organización y le suma 1
  -- Si es un mes nuevo, MAX() devolverá NULL y COALESCE lo transformará en 0 + 1 = 1
  SELECT COALESCE(MAX(order_seq), 0) + 1 
  INTO NEW.order_seq 
  FROM public.orders 
  WHERE org_id = NEW.org_id
    AND date_trunc('month', created_at) = date_trunc('month', NOW());

  RETURN NEW;
END;
$$;