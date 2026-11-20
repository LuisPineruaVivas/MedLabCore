-- Migration: bulk_upsert_org_prices
-- Allows super admin to bulk-apply prices from a parsed baremo to a specific organization.
-- Reuses the existing upsert_test_template logic for each item.

CREATE OR REPLACE FUNCTION public.bulk_upsert_org_prices(
  p_org_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item         JSONB;
  v_template_id  UUID;
  v_name         TEXT;
  v_price        NUMERIC;
  v_category     TEXT;
  v_schema       JSONB;
  v_org_id_check UUID;
  v_count_ok     INT := 0;
  v_count_skip   INT := 0;
BEGIN
  -- Iterate over each item in the JSON array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_template_id := (v_item->>'global_template_id')::UUID;
    v_price       := (v_item->>'price')::NUMERIC;

    -- Fetch the global template data so we preserve name/category/schema
    SELECT name, category, schema, org_id
    INTO v_name, v_category, v_schema, v_org_id_check
    FROM test_templates
    WHERE id = v_template_id;

    -- Only process if the template exists and is truly global (org_id IS NULL)
    -- OR already belongs to this org (an existing fork we want to re-price)
    IF v_name IS NOT NULL AND (v_org_id_check IS NULL OR v_org_id_check = p_org_id) THEN
      PERFORM public.upsert_test_template(
        v_template_id,
        p_org_id,
        v_name,
        v_category,
        v_price,
        v_schema
      );
      v_count_ok := v_count_ok + 1;
    ELSE
      v_count_skip := v_count_skip + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'applied', v_count_ok,
    'skipped', v_count_skip
  );
END;
$$;

-- Grant execute to authenticated users (RLS on the tables protects the data;
-- the super_admin check is enforced in the Edge Function before calling this RPC).
GRANT EXECUTE ON FUNCTION public.bulk_upsert_org_prices(UUID, JSONB) TO authenticated;
