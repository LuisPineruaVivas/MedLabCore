-- ==============================================================================
-- Migración: Módulo de Suscripciones y Panel de Super Admin
-- ==============================================================================

-- 1. Agregar columnas de suscripción a la tabla de organizaciones
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
ADD COLUMN IF NOT EXISTS subscription_grace_until TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS subscription_plan_price NUMERIC(10,2) DEFAULT 29.00;

-- Inicializar organizaciones existentes que tengan subscription_expires_at en NULL
UPDATE public.organizations
SET subscription_expires_at = COALESCE(subscription_expires_at, now() + interval '30 days'),
    subscription_plan_price = COALESCE(subscription_plan_price, 29.00)
WHERE subscription_expires_at IS NULL;

-- 2. Tipo enum para estado del pago de suscripción
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_payment_status') THEN
    CREATE TYPE public.subscription_payment_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- 3. Tabla para el reporte y registro de pagos de suscripciones
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 29.00,
  amount_bs NUMERIC(14, 2) NULL,
  exchange_rate NUMERIC(10, 4) NULL,
  payment_method TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  proof_url TEXT NOT NULL,
  notes TEXT NULL,
  status public.subscription_payment_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_subscription_payments_org ON public.subscription_payments(org_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON public.subscription_payments(created_at DESC);

-- 4. Habilitar RLS en subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Super admins can manage all subscription payments" ON public.subscription_payments;
CREATE POLICY "Super admins can manage all subscription payments"
ON public.subscription_payments
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.user_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.user_role));

DROP POLICY IF EXISTS "Lab members can view their organization subscription payments" ON public.subscription_payments;
CREATE POLICY "Lab members can view their organization subscription payments"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lab admins can submit subscription payments" ON public.subscription_payments;
CREATE POLICY "Lab admins can submit subscription payments"
ON public.subscription_payments
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT p.org_id FROM public.profiles p 
    WHERE p.id = auth.uid() 
      AND p.role IN ('lab_admin'::public.user_role, 'super_admin'::public.user_role)
  )
);

-- 5. Bucket de almacenamiento en Supabase Storage para comprobantes de pago
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas del bucket de almacenamiento
DROP POLICY IF EXISTS "Public view for payment proofs" ON storage.objects;
CREATE POLICY "Public view for payment proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- 6. Función RPC para Reportar Pago (Lab Admin)
CREATE OR REPLACE FUNCTION public.report_subscription_payment(
  p_org_id UUID,
  p_amount_usd NUMERIC,
  p_amount_bs NUMERIC,
  p_exchange_rate NUMERIC,
  p_payment_method TEXT,
  p_reference_number TEXT,
  p_payment_date DATE,
  p_proof_url TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_org UUID;
  v_is_super BOOLEAN;
  v_payment_id UUID;
  v_grace_until TIMESTAMPTZ;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin'::public.user_role) INTO v_is_super;
  SELECT org_id INTO v_caller_org FROM public.profiles WHERE id = auth.uid();

  IF NOT v_is_super AND (v_caller_org IS NULL OR v_caller_org <> p_org_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot report payment for another organization';
  END IF;

  -- 1. Insertar el registro de pago
  INSERT INTO public.subscription_payments (
    org_id,
    amount_usd,
    amount_bs,
    exchange_rate,
    payment_method,
    reference_number,
    payment_date,
    proof_url,
    notes,
    status
  ) VALUES (
    p_org_id,
    COALESCE(p_amount_usd, 29.00),
    p_amount_bs,
    p_exchange_rate,
    p_payment_method,
    p_reference_number,
    COALESCE(p_payment_date, CURRENT_DATE),
    p_proof_url,
    p_notes,
    'pending'
  ) RETURNING id INTO v_payment_id;

  -- 2. Activar período de gracia de 3 días mientras el Super Admin revisa
  v_grace_until := now() + interval '3 days';
  UPDATE public.organizations
  SET subscription_grace_until = v_grace_until,
      subscription_active = true
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'grace_until', v_grace_until
  );
END;
$$;

-- 7. Función RPC para Aprobar Pago (Super Admin)
CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_payment public.subscription_payments%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin'::public.user_role) INTO v_is_super;
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Super admin role required';
  END IF;

  SELECT * INTO v_payment FROM public.subscription_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_payment.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Cálculo de fecha: si aún no expira, suma 30 días a la fecha existente. Si ya expiró, suma 30 días desde hoy.
  IF v_org.subscription_expires_at IS NOT NULL AND v_org.subscription_expires_at > now() THEN
    v_new_expires_at := v_org.subscription_expires_at + interval '30 days';
  ELSE
    v_new_expires_at := now() + interval '30 days';
  END IF;

  -- Actualizar organización
  UPDATE public.organizations
  SET subscription_expires_at = v_new_expires_at,
      subscription_active = true,
      subscription_grace_until = NULL
  WHERE id = v_org.id;

  -- Actualizar pago
  UPDATE public.subscription_payments
  SET status = 'approved',
      rejection_reason = NULL,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'new_expires_at', v_new_expires_at,
    'org_id', v_org.id
  );
END;
$$;

-- 8. Función RPC para Negar Pago (Super Admin)
CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_payment_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_payment public.subscription_payments%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_has_other_pending BOOLEAN;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin'::public.user_role) INTO v_is_super;
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Super admin role required';
  END IF;

  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_payment FROM public.subscription_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  -- Actualizar pago
  UPDATE public.subscription_payments
  SET status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  -- Verificar si la organización tiene otros pagos pendientes válidos
  SELECT EXISTS (
    SELECT 1 FROM public.subscription_payments
    WHERE org_id = v_payment.org_id
      AND id <> p_payment_id
      AND status = 'pending'
  ) INTO v_has_other_pending;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_payment.org_id;

  -- Si no tiene otros pagos pendientes, revocar la gracia
  IF NOT v_has_other_pending THEN
    UPDATE public.organizations
    SET subscription_grace_until = NULL,
        subscription_active = CASE
          WHEN subscription_expires_at IS NOT NULL AND subscription_expires_at > now() THEN true
          ELSE false
        END
    WHERE id = v_payment.org_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', 'rejected'
  );
END;
$$;

-- 9. Función RPC para Dashboard de Estadísticas Globales de Super Admin
CREATE OR REPLACE FUNCTION public.get_superadmin_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT public.has_role(auth.uid(), 'super_admin'::public.user_role) INTO v_is_super;
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Super admin role required';
  END IF;

  WITH org_metrics AS (
    SELECT
      o.id,
      o.name,
      o.rif,
      o.email,
      o.phone,
      o.city,
      o.state,
      o.is_active,
      o.subscription_active,
      o.subscription_expires_at,
      o.subscription_grace_until,
      o.created_at,
      (
        SELECT p.full_name
        FROM public.profiles p
        WHERE p.org_id = o.id AND p.role = 'lab_admin'
        ORDER BY p.created_at ASC
        LIMIT 1
      ) AS admin_name,
      (
        SELECT p.email
        FROM public.profiles p
        WHERE p.org_id = o.id AND p.role = 'lab_admin'
        ORDER BY p.created_at ASC
        LIMIT 1
      ) AS admin_email,
      (SELECT count(*) FROM public.patients WHERE org_id = o.id) AS total_patients,
      (SELECT count(*) FROM public.orders WHERE org_id = o.id) AS total_orders,
      (
        SELECT count(*)
        FROM public.orders
        WHERE org_id = o.id
          AND created_at >= date_trunc('month', now())
      ) AS orders_this_month,
      (
        SELECT count(*)
        FROM public.orders
        WHERE org_id = o.id
          AND created_at >= date_trunc('day', now())
      ) AS orders_today,
      (
        SELECT jsonb_build_object(
          'id', sp.id,
          'status', sp.status,
          'payment_date', sp.payment_date,
          'amount_usd', sp.amount_usd,
          'created_at', sp.created_at
        )
        FROM public.subscription_payments sp
        WHERE sp.org_id = o.id
        ORDER BY sp.created_at DESC
        LIMIT 1
      ) AS latest_payment
    FROM public.organizations o
    ORDER BY o.name ASC
  ),
  global_counts AS (
    SELECT
      count(*) AS total_orgs,
      count(*) FILTER (
        WHERE (subscription_expires_at > now() OR (subscription_grace_until IS NOT NULL AND subscription_grace_until > now()))
          AND (is_active IS NULL OR is_active = true)
      ) AS active_orgs,
      count(*) FILTER (
        WHERE (subscription_expires_at <= now() OR subscription_expires_at IS NULL)
          AND (subscription_grace_until IS NULL OR subscription_grace_until <= now())
      ) AS expired_orgs,
      count(*) FILTER (
        WHERE subscription_expires_at > now()
          AND subscription_expires_at <= (now() + interval '3 days')
      ) AS expiring_soon_orgs
    FROM public.organizations
  ),
  payment_counts AS (
    SELECT
      count(*) FILTER (WHERE status = 'pending') AS pending_payments,
      count(*) FILTER (WHERE status = 'approved') AS approved_payments,
      count(*) FILTER (WHERE status = 'rejected') AS rejected_payments
    FROM public.subscription_payments
  ),
  orders_totals AS (
    SELECT
      count(*) AS total_orders,
      count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS orders_month,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS orders_today
    FROM public.orders
  ),
  patients_total AS (
    SELECT count(*) AS total_patients FROM public.patients
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_organizations', gc.total_orgs,
      'active_subscriptions', gc.active_orgs,
      'expired_subscriptions', gc.expired_orgs,
      'expiring_soon_subscriptions', gc.expiring_soon_orgs,
      'pending_payments', pc.pending_payments,
      'approved_payments', pc.approved_payments,
      'rejected_payments', pc.rejected_payments,
      'total_patients', pt.total_patients,
      'total_orders', ot.total_orders,
      'orders_month', ot.orders_month,
      'orders_today', ot.orders_today
    ),
    'organizations', (SELECT coalesce(jsonb_agg(to_jsonb(om.*)), '[]'::jsonb) FROM org_metrics om)
  ) INTO v_result
  FROM global_counts gc, payment_counts pc, orders_totals ot, patients_total pt;

  RETURN v_result;
END;
$$;


-- ==============================================================================
-- 10. Registrar la migración en el historial interno de Supabase
-- Esto garantiza que futuras ejecuciones de `supabase db push` en dev o main
-- reconozcan que esta migración ya fue aplicada y no intenten duplicarla.
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20261029000000')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
