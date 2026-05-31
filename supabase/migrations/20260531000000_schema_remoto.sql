


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."order_status" AS ENUM (
    'pendiente',
    'procesando',
    'por_aprobar',
    'completada',
    'cancelada'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'partial',
    'paid'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'lab_admin',
    'bioanalyst',
    'secretary'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_lab_order"("p_org_id" "uuid", "p_patient_id" "uuid", "p_notes" "text", "p_exchange_rate" numeric, "p_total_bs" numeric, "p_is_exempted" boolean, "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_header_row_id uuid;
  v_total_amount numeric := 0;
  v_effective_total_amount numeric := 0;
  v_effective_total_bs numeric := null;
  v_profile_header_ids jsonb := '{}'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED';
  end if;

  select coalesce(sum(coalesce((item->>'price')::numeric, 0)), 0)
  into v_total_amount
  from jsonb_array_elements(p_items) item;

  v_effective_total_amount := case when coalesce(p_is_exempted, false) then 0 else v_total_amount end;
  v_effective_total_bs := case
    when coalesce(p_is_exempted, false) and p_total_bs is not null then 0
    when coalesce(p_is_exempted, false) then null
    else p_total_bs
  end;

  insert into public.orders (
    org_id,
    patient_id,
    total_amount,
    notes,
    exchange_rate,
    total_bs,
    is_exempted
  )
  values (
    p_org_id,
    p_patient_id,
    v_effective_total_amount,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_exchange_rate,
    v_effective_total_bs,
    coalesce(p_is_exempted, false)
  )
  returning * into v_order;

  for v_item in
    select item
    from jsonb_array_elements(p_items) as item
    where coalesce((item->>'isProfileHeader')::boolean, false) = true
  loop
    insert into public.order_items (
      order_id,
      template_id,
      test_name,
      price_at_order,
      results_data,
      is_profile_header
    )
    values (
      v_order.id,
      null,
      v_item->>'test_name',
      coalesce((v_item->>'price')::numeric, 0),
      null,
      true
    )
    returning id into v_header_row_id;

    if coalesce(v_item->>'profileId', '') <> '' then
      v_profile_header_ids := jsonb_set(
        v_profile_header_ids,
        array[v_item->>'profileId'],
        to_jsonb(v_header_row_id::text),
        true
      );
    end if;
  end loop;

  for v_item in
    select item
    from jsonb_array_elements(p_items) as item
    where coalesce((item->>'parentProfileId')::text, '') <> ''
  loop
    insert into public.order_items (
      order_id,
      template_id,
      test_name,
      price_at_order,
      results_data,
      parent_profile_id,
      is_profile_header
    )
    values (
      v_order.id,
      nullif(v_item->>'template_id', '')::uuid,
      v_item->>'test_name',
      0,
      coalesce(v_item->'schema', '{"sections":[]}'::jsonb),
      nullif(v_profile_header_ids ->> (v_item->>'parentProfileId'), '')::uuid,
      false
    );
  end loop;

  insert into public.order_items (
    order_id,
    template_id,
    test_name,
    price_at_order,
    results_data,
    is_profile_header
  )
  select
    v_order.id,
    nullif(item->>'template_id', '')::uuid,
    item->>'test_name',
    coalesce((item->>'price')::numeric, 0),
    coalesce(item->'schema', '{"sections":[]}'::jsonb),
    false
  from jsonb_array_elements(p_items) as item
  where coalesce((item->>'isProfileHeader')::boolean, false) = false
    and coalesce((item->>'parentProfileId')::text, '') = '';

  return jsonb_build_object(
    'success', true,
    'orderId', v_order.id,
    'access_pin', v_order.access_pin,
    'order_seq', v_order.order_seq,
    'userSafeMessage', 'Orden creada correctamente',
    'technicalCode', 'ORDER_CREATED'
  );
end;
$$;


ALTER FUNCTION "public"."create_lab_order"("p_org_id" "uuid", "p_patient_id" "uuid", "p_notes" "text", "p_exchange_rate" numeric, "p_total_bs" numeric, "p_is_exempted" boolean, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_access_pin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.access_pin := upper(substring(gen_random_uuid()::text from 1 for 8));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_access_pin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_summary"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$WITH bounds AS (
    SELECT
      (date_trunc('day', now() AT TIME ZONE 'America/Caracas') AT TIME ZONE 'America/Caracas') AS today_start,
      (date_trunc('day', (now() AT TIME ZONE 'America/Caracas') - interval '1 day') AT TIME ZONE 'America/Caracas') AS yesterday_start,
      (date_trunc('month', now() AT TIME ZONE 'America/Caracas') AT TIME ZONE 'America/Caracas') AS month_start
  )
  select jsonb_build_object(
    'totalPatients', (select count(*) from public.patients p where p.org_id = p_org_id),
    'thisMonthPatients', (
      select count(*)
      from public.patients p, bounds b
      where p.org_id = p_org_id and p.created_at >= b.month_start
    ),
    'ordersToday', (
      select count(*)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.today_start
    ),
    'ordersYesterday', (
      select count(*)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.yesterday_start and o.created_at < b.today_start
    ),
    'pendingOrders', (
      select count(*)
      from public.orders o
      where o.org_id = p_org_id and o.status = 'pendiente'
    ),
    'todayRevenue', (
      select coalesce(sum(o.total_amount), 0)
      from public.orders o, bounds b
      where o.org_id = p_org_id and o.created_at >= b.today_start
    )
  );$$;


ALTER FUNCTION "public"."get_dashboard_summary"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_top_tests"("p_org_id" "uuid", "p_limit" integer DEFAULT 5) RETURNS TABLE("name" "text", "count" bigint, "pct" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with counted as (
    select oi.test_name, count(*)::bigint as usage_count
    from public.order_items oi
    inner join public.orders o on o.id = oi.order_id
    where o.org_id = p_org_id
      and oi.is_profile_header = false
    group by oi.test_name
    order by usage_count desc, oi.test_name asc
    limit p_limit
  ),
  max_count as (
    select greatest(coalesce(max(usage_count), 1), 1) as top_count
    from counted
  )
  select
    counted.test_name as name,
    counted.usage_count as count,
    round((counted.usage_count::numeric / max_count.top_count::numeric) * 100)::integer as pct
  from counted
  cross join max_count;
$$;


ALTER FUNCTION "public"."get_dashboard_top_tests"("p_org_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_order_seq"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Busca el número máximo actual para esa organización y le suma 1
  SELECT COALESCE(MAX(order_seq), 0) + 1 
  INTO NEW.order_seq 
  FROM orders 
  WHERE org_id = NEW.org_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."get_next_order_seq"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
  INSERT INTO public.profiles (id, full_name, org_id, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    (NEW.raw_user_meta_data ->> 'org_id')::uuid,
    new.email,
    'lab_admin'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lab_admin');
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_authenticate"("p_dni" "text", "p_pin" "text") RETURNS TABLE("patient_id" "uuid", "first_name" "text", "last_name" "text", "id_number" "text", "date_of_birth" "date", "gender" "text", "phone" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id, pt.first_name, pt.last_name, pt.id_number,
    pt.date_of_birth, pt.gender, pt.phone, pt.email
  FROM public.orders o
  INNER JOIN public.patients pt ON pt.id = o.patient_id
  WHERE
    upper(trim(pt.id_number))  = upper(trim(p_dni))
    AND upper(trim(o.access_pin)) = upper(trim(p_pin))
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."portal_authenticate"("p_dni" "text", "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid", "p_pin" "text") RETURNS TABLE("order_id" "uuid", "created_at" timestamp with time zone, "status" "text", "total_amount" numeric, "access_pin" "text", "order_seq" integer, "org_name" "text", "org_logo_url" "text", "firma_url" "text", "sello_url" "text", "department_order" "jsonb", "items" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reference_date timestamptz;
begin
  select o.created_at
  into v_reference_date
  from public.orders o
  where o.patient_id = p_patient_id
    and upper(trim(o.access_pin)) = upper(trim(p_pin))
  limit 1;

  if v_reference_date is null then
    return;
  end if;

  return query
  select
    o.id as order_id,
    o.created_at,
    o.status::text,
    o.total_amount,
    o.access_pin,
    o.order_seq,
    org.name::text as org_name,
    org.logo_url::text as org_logo_url,
    o.firma_url::text,
    o.sello_url::text,
    coalesce(
      (
        select jsonb_agg(category_settings.department_name order by category_settings.custom_sort_order, category_settings.department_name)
        from public.organization_test_category_settings category_settings
        where category_settings.org_id = o.org_id
      ),
      '[]'::jsonb
    ) as department_order,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'template_id', oi.template_id,
            'test_name', oi.test_name,
            'price_at_order', oi.price_at_order,
            'results_data', oi.results_data,
            'created_at', oi.created_at,
            'parent_profile_id', oi.parent_profile_id,
            'is_profile_header', oi.is_profile_header,
            'category', coalesce(tt.category, 'General'),
            'resolved_sort_order', coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999)
          )
          order by
            coalesce(category_settings.custom_sort_order, 2147483647),
            coalesce(tt.category, 'General'),
            coalesce(exam_settings.custom_sort_order, tt.sort_order, 9999),
            oi.created_at,
            oi.test_name
        )
        from public.order_items oi
        left join public.test_templates tt on tt.id = oi.template_id
        left join public.organization_exam_settings exam_settings
          on exam_settings.org_id = o.org_id
         and exam_settings.template_id = oi.template_id
        left join public.organization_test_category_settings category_settings
          on category_settings.org_id = o.org_id
         and category_settings.department_name = coalesce(tt.category, 'General')
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ) as items
  from public.orders o
  inner join public.organizations org on org.id = o.org_id
  where o.patient_id = p_patient_id
    and o.created_at <= v_reference_date
    and lower(o.status::text) = 'completada'
  order by o.created_at desc;
end;
$$;


ALTER FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid", "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_self_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_user_id UUID := auth.uid();
  is_super_admin BOOLEAN;
BEGIN
  -- 1. Si la query viene del sistema/editor SQL (sin usuario logueado), permitir todo
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Verificamos si el que ejecuta es super_admin
  is_super_admin := public.has_role(current_user_id, 'super_admin');

  -- 3. Lógica de restricción
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    
    -- Si NO es super_admin...
    IF NOT is_super_admin THEN
      
      -- REGLA A: Nadie puede editar su propio rol (excepto super_admins)
      IF OLD.id = current_user_id THEN
        RAISE EXCEPTION 'Permission denied: you cannot modify your own role.';
      END IF;

      -- REGLA B: Solo el admin del laboratorio puede editar a OTROS (pero no a sí mismo)
      -- Aquí verificamos si el que edita es admin_laboratorio
      IF NOT public.has_role(current_user_id, 'lab_admin') THEN
        RAISE EXCEPTION 'Permission denied: you do not have permission to change roles.';
      END IF;
      
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_self_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_exam_profile"("p_profile_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_description" "text", "p_total_price" numeric, "p_template_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid;
begin
  if p_profile_id is null then
    insert into public.exam_profiles (
      org_id,
      name,
      description,
      total_price
    )
    values (
      p_org_id,
      p_name,
      nullif(trim(coalesce(p_description, '')), ''),
      p_total_price
    )
    returning id into v_profile_id;
  else
    update public.exam_profiles
    set
      name = p_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      total_price = p_total_price
    where id = p_profile_id
    returning id into v_profile_id;

    delete from public.profile_templates_junction
    where profile_id = v_profile_id;
  end if;

  if array_length(p_template_ids, 1) is not null then
    insert into public.profile_templates_junction (profile_id, template_id)
    select v_profile_id, unnest(p_template_ids);
  end if;

  return jsonb_build_object(
    'success', true,
    'profileId', v_profile_id,
    'userSafeMessage', 'Perfil guardado correctamente',
    'technicalCode', 'PROFILE_SAVED'
  );
end;
$$;


ALTER FUNCTION "public"."upsert_exam_profile"("p_profile_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_description" "text", "p_total_price" numeric, "p_template_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_test_template"("p_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_category" "text", "p_base_price" numeric, "p_schema" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_original_org_id UUID;
    v_exists BOOLEAN;
BEGIN
    -- 1. Buscamos si el ID existe y a quién pertenece
    SELECT org_id, TRUE INTO v_original_org_id, v_exists
    FROM test_templates 
    WHERE id = p_id;

    -- 2. CASO A: El examen existe y es GLOBAL (org_id is NULL)
    -- Acción: CLONAR (Insertar nuevo con referencia)
    IF v_exists AND v_original_org_id IS NULL THEN
        INSERT INTO test_templates (
            org_id, 
            id_global_ref, 
            name, 
            category, 
            base_price, 
            schema, 
            is_active,
            updated_at
        )
        VALUES (
            p_org_id, 
            p_id,      -- Aquí guardamos el ID del original como referencia
            p_name, 
            p_category, 
            p_base_price, 
            p_schema, 
            TRUE,
            NOW()
        );

    -- 3. CASO B: El examen existe y YA ES del laboratorio (org_id = p_org_id)
    -- Acción: ACTUALIZAR
    ELSIF v_exists AND v_original_org_id = p_org_id THEN
        UPDATE test_templates
        SET 
            name = p_name,
            category = p_category,
            base_price = p_base_price,
            schema = p_schema,
            updated_at = NOW()
        WHERE id = p_id;

    -- 4. CASO C: El ID no existe o es un examen nuevo
    -- Acción: INSERTAR DESDE CERO
    ELSE
        INSERT INTO test_templates (
            org_id, 
            name, 
            category, 
            base_price, 
            schema, 
            is_active,
            updated_at
        )
        VALUES (
            p_org_id, 
            p_name, 
            p_category, 
            p_base_price, 
            p_schema, 
            TRUE,
            NOW()
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_test_template"("p_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_category" "text", "p_base_price" numeric, "p_schema" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exam_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "total_price" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exam_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "rate" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "test_name" "text" NOT NULL,
    "price_at_order" numeric DEFAULT 0 NOT NULL,
    "results_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_profile_id" "uuid",
    "is_profile_header" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "status" "public"."order_status" DEFAULT 'pendiente'::"public"."order_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status" NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_pin" "text",
    "exchange_rate" numeric,
    "total_bs" numeric,
    "completed_at" timestamp with time zone,
    "order_seq" integer,
    "firma_url" "text",
    "sello_url" "text",
    "is_exempted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_exam_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "template_id" "uuid",
    "custom_sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_exam_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_test_category_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "department_name" "text" NOT NULL,
    "custom_sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_test_category_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "country" "text",
    "state" "text",
    "city" "text",
    "address" "text",
    "subscription_active" boolean DEFAULT true NOT NULL,
    "logo_url" "text",
    "phone" "text",
    "email" "text",
    "primary_color" "text" DEFAULT '#0ea5e9'::"text",
    "secondary_color" "text" DEFAULT '#64748b'::"text",
    "rif" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "id_number" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "gender" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "occupation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "patients_gender_check" CHECK (("gender" = ANY (ARRAY['masculino'::"text", 'femenino'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_templates_junction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL
);


ALTER TABLE "public"."profile_templates_junction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid",
    "role" "public"."user_role" DEFAULT 'secretary'::"public"."user_role" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" DEFAULT ''::"text",
    "firma_url" "text",
    "sello_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "base_price" numeric DEFAULT 0 NOT NULL,
    "schema" "jsonb" DEFAULT '{"sections": []}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id_global_ref" "uuid",
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."test_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_templates_backup" (
    "id" "uuid",
    "org_id" "uuid",
    "name" "text",
    "category" "text",
    "base_price" numeric,
    "schema" "jsonb",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "id_global_ref" "uuid",
    "sort_order" integer
);


ALTER TABLE "public"."test_templates_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'secretary'::"public"."user_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_test_templates_filtered" AS
 WITH "user_context" AS (
         SELECT "profiles"."org_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())
        )
 SELECT DISTINCT ON (COALESCE("id_global_ref", "id")) "id",
    "name",
    "category",
    "base_price",
    "is_active",
    "org_id",
    "id_global_ref",
    "sort_order",
    "schema",
    "created_at"
   FROM "public"."test_templates"
  WHERE (("is_active" = true) AND (("org_id" IS NULL) OR ("org_id" = ( SELECT "user_context"."org_id"
           FROM "user_context"))))
  ORDER BY COALESCE("id_global_ref", "id"), "org_id" DESC NULLS LAST;


ALTER VIEW "public"."v_test_templates_filtered" OWNER TO "postgres";


ALTER TABLE ONLY "public"."exam_profiles"
    ADD CONSTRAINT "exam_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_exam_settings"
    ADD CONSTRAINT "organization_exam_settings_org_id_template_id_key" UNIQUE ("org_id", "template_id");



ALTER TABLE ONLY "public"."organization_exam_settings"
    ADD CONSTRAINT "organization_exam_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_test_category_settings"
    ADD CONSTRAINT "organization_test_category_settings_org_id_department_name_key" UNIQUE ("org_id", "department_name");



ALTER TABLE ONLY "public"."organization_test_category_settings"
    ADD CONSTRAINT "organization_test_category_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_id_number_org_unique" UNIQUE ("org_id", "id_number");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_profile_id_template_id_key" UNIQUE ("profile_id", "template_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_templates"
    ADD CONSTRAINT "test_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_org_exam_settings_lookup" ON "public"."organization_exam_settings" USING "btree" ("org_id", "template_id");



CREATE INDEX "idx_org_test_category_settings_org_id" ON "public"."organization_test_category_settings" USING "btree" ("org_id");



CREATE INDEX "idx_org_test_category_settings_sort_order" ON "public"."organization_test_category_settings" USING "btree" ("org_id", "custom_sort_order");



CREATE INDEX "idx_test_templates_category" ON "public"."test_templates" USING "btree" ("category");



CREATE INDEX "idx_test_templates_org_id" ON "public"."test_templates" USING "btree" ("org_id");



CREATE OR REPLACE TRIGGER "trg_generate_access_pin" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_order_access_pin"();



CREATE OR REPLACE TRIGGER "trg_organization_test_category_settings_updated_at" BEFORE UPDATE ON "public"."organization_test_category_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_role_self_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_self_update"();



CREATE OR REPLACE TRIGGER "trigger_set_order_seq" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."get_next_order_seq"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."exam_profiles"
    ADD CONSTRAINT "exam_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."test_templates"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."organization_exam_settings"
    ADD CONSTRAINT "organization_exam_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_exam_settings"
    ADD CONSTRAINT "organization_exam_settings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."test_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_test_category_settings"
    ADD CONSTRAINT "organization_test_category_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."exam_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."test_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_templates"
    ADD CONSTRAINT "test_templates_id_global_ref_fkey" FOREIGN KEY ("id_global_ref") REFERENCES "public"."test_templates"("id");



ALTER TABLE ONLY "public"."test_templates"
    ADD CONSTRAINT "test_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Admins can manage organizations" ON "public"."organizations" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Lab admins can manage department order" ON "public"."organization_test_category_settings" TO "authenticated" USING ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND ("public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role")))) WITH CHECK ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND ("public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"))));



CREATE POLICY "Lab admins can manage exam_profiles" ON "public"."exam_profiles" USING ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND ("public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"))));



CREATE POLICY "Lab admins can manage exchange rates" ON "public"."exchange_rates" USING ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND ("public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"))));



CREATE POLICY "Lab admins can manage profile_templates_junction" ON "public"."profile_templates_junction" USING ((EXISTS ( SELECT 1
   FROM "public"."exam_profiles" "ep"
  WHERE (("ep"."id" = "profile_templates_junction"."profile_id") AND ("ep"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"()))) AND ("public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"))))));



CREATE POLICY "Lab admins can update their own organization" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "organizations"."id") AND ("profiles"."role" = ANY (ARRAY['lab_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "organizations"."id")))));



CREATE POLICY "Members of the same org can view each other" ON "public"."profiles" FOR SELECT USING (("org_id" = "public"."get_my_org_id"()));



CREATE POLICY "Public can read exchange rates" ON "public"."exchange_rates" FOR SELECT USING (true);



CREATE POLICY "Public organization branding is viewable by anyone" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Super admins can manage all patients" ON "public"."patients" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins can manage profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins can manage user_roles" ON "public"."user_roles" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins full access on exam_profiles" ON "public"."exam_profiles" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins full access on order_items" ON "public"."order_items" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins full access on orders" ON "public"."orders" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins full access on profile_templates_junction" ON "public"."profile_templates_junction" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admins full access on test_templates" ON "public"."test_templates" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Users can insert order_items in their org" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert orders in their org" ON "public"."orders" FOR INSERT WITH CHECK (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert patients in their org" ON "public"."patients" FOR INSERT WITH CHECK (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert templates for their own organization" ON "public"."test_templates" FOR INSERT TO "authenticated" WITH CHECK (((("org_id" IS NULL) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"public"."user_role")) OR (("org_id" = ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'lab_admin'::"public"."user_role"))));



CREATE POLICY "Users can read department order in their org" ON "public"."organization_test_category_settings" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read exam_profiles in their org" ON "public"."exam_profiles" FOR SELECT USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read global templates" ON "public"."test_templates" FOR SELECT TO "authenticated" USING ((("org_id" IS NULL) AND ("is_active" = true)));



CREATE POLICY "Users can read order_items in their org" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can read orders in their org" ON "public"."orders" FOR SELECT USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read own org exchange rate" ON "public"."exchange_rates" FOR SELECT USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read own org templates" ON "public"."test_templates" FOR SELECT TO "authenticated" USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can read own role" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read patients in their org" ON "public"."patients" FOR SELECT USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read profile_templates_junction in their org" ON "public"."profile_templates_junction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."exam_profiles" "ep"
  WHERE (("ep"."id" = "profile_templates_junction"."profile_id") AND ("ep"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can update order_items in their org" ON "public"."order_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."org_id" = ( SELECT "p"."org_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can update orders in their org" ON "public"."orders" FOR UPDATE USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update patients in their org" ON "public"."patients" FOR UPDATE USING (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK (("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own organization's templates" ON "public"."test_templates" FOR UPDATE TO "authenticated" USING (((("org_id" IS NULL) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"public"."user_role")) OR (("org_id" = ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'lab_admin'::"public"."user_role")))) WITH CHECK (((("org_id" IS NULL) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"public"."user_role")) OR (("org_id" = ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'lab_admin'::"public"."user_role"))));



CREATE POLICY "Users can view relevant templates" ON "public"."test_templates" FOR SELECT TO "authenticated" USING ((("org_id" IS NULL) OR ("org_id" = ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own organization" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "profiles"."org_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."exam_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_exam_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_exam_settings_full_access" ON "public"."organization_exam_settings" TO "authenticated" USING (("org_id" IN ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK (("org_id" IN ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



ALTER TABLE "public"."organization_test_category_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_templates_junction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_templates_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."create_lab_order"("p_org_id" "uuid", "p_patient_id" "uuid", "p_notes" "text", "p_exchange_rate" numeric, "p_total_bs" numeric, "p_is_exempted" boolean, "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_lab_order"("p_org_id" "uuid", "p_patient_id" "uuid", "p_notes" "text", "p_exchange_rate" numeric, "p_total_bs" numeric, "p_is_exempted" boolean, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_lab_order"("p_org_id" "uuid", "p_patient_id" "uuid", "p_notes" "text", "p_exchange_rate" numeric, "p_total_bs" numeric, "p_is_exempted" boolean, "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_top_tests"("p_org_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_top_tests"("p_org_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_top_tests"("p_org_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_order_seq"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_order_seq"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_order_seq"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."user_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_authenticate"("p_dni" "text", "p_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_authenticate"("p_dni" "text", "p_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_authenticate"("p_dni" "text", "p_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid", "p_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid", "p_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid", "p_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_exam_profile"("p_profile_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_description" "text", "p_total_price" numeric, "p_template_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_exam_profile"("p_profile_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_description" "text", "p_total_price" numeric, "p_template_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_exam_profile"("p_profile_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_description" "text", "p_total_price" numeric, "p_template_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_test_template"("p_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_category" "text", "p_base_price" numeric, "p_schema" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_test_template"("p_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_category" "text", "p_base_price" numeric, "p_schema" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_test_template"("p_id" "uuid", "p_org_id" "uuid", "p_name" "text", "p_category" "text", "p_base_price" numeric, "p_schema" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."exam_profiles" TO "anon";
GRANT ALL ON TABLE "public"."exam_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."organization_exam_settings" TO "anon";
GRANT ALL ON TABLE "public"."organization_exam_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_exam_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organization_test_category_settings" TO "anon";
GRANT ALL ON TABLE "public"."organization_test_category_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_test_category_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."profile_templates_junction" TO "anon";
GRANT ALL ON TABLE "public"."profile_templates_junction" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_templates_junction" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."test_templates" TO "anon";
GRANT ALL ON TABLE "public"."test_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."test_templates" TO "service_role";



GRANT ALL ON TABLE "public"."test_templates_backup" TO "anon";
GRANT ALL ON TABLE "public"."test_templates_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."test_templates_backup" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_test_templates_filtered" TO "anon";
GRANT ALL ON TABLE "public"."v_test_templates_filtered" TO "authenticated";
GRANT ALL ON TABLE "public"."v_test_templates_filtered" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































