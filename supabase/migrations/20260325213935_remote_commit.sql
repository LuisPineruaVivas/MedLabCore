


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



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."order_status" AS ENUM (
    'pendiente',
    'procesando',
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


CREATE OR REPLACE FUNCTION "public"."generate_order_access_pin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.access_pin := upper(substring(gen_random_uuid()::text from 1 for 8));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_access_pin"() OWNER TO "postgres";


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
  INSERT INTO public.profiles (id, full_name, org_id, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    (NEW.raw_user_meta_data ->> 'org_id')::uuid,
    new.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'secretary');
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


CREATE OR REPLACE FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "status" "text", "total_amount" numeric, "access_pin" "text", "order_seq" integer, "org_name" "text", "org_logo_url" "text", "items" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id, 
    o.created_at, 
    o.status::text, 
    o.total_amount, 
    o.access_pin,
    o.order_seq,            -- Columna 6 (Integer)
    org.name::text,         -- Columna 7
    org.logo_url::text,     -- Columna 8
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id, 
          'test_name', oi.test_name, 
          'price_at_order', oi.price_at_order,
          'results_data', oi.results_data, 
          'created_at', oi.created_at, 
          'category', tt.category
        ) ORDER BY oi.created_at
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) AS items               -- Columna 9 (JSONB)
  FROM public.orders o
  INNER JOIN public.organizations org ON org.id = o.org_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.test_templates tt ON tt.id = oi.template_id
  WHERE o.patient_id = p_patient_id AND o.status = 'completada'
  GROUP BY o.id, o.created_at, o.status, o.total_amount, o.access_pin, o.order_seq, org.name, org.logo_url
  ORDER BY o.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_self_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Permission denied: you cannot modify your own role.';
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
    "order_seq" integer
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


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
    "email" "text" DEFAULT ''::"text"
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
    "id_global_ref" "uuid"
);


ALTER TABLE "public"."test_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'secretary'::"public"."user_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_test_templates_filtered" AS
 SELECT DISTINCT ON (COALESCE("id_global_ref", "id")) "id",
    "org_id",
    "name",
    "category",
    "base_price",
    "schema",
    "is_active",
    "created_at",
    "updated_at",
    "id_global_ref"
   FROM "public"."test_templates"
  ORDER BY COALESCE("id_global_ref", "id"), "org_id";


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



CREATE INDEX "idx_test_templates_category" ON "public"."test_templates" USING "btree" ("category");



CREATE INDEX "idx_test_templates_org_id" ON "public"."test_templates" USING "btree" ("org_id");



CREATE OR REPLACE TRIGGER "trg_generate_access_pin" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_order_access_pin"();



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
    ADD CONSTRAINT "order_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."test_templates"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."exam_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_templates_junction"
    ADD CONSTRAINT "profile_templates_junction_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."test_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."test_templates"
    ADD CONSTRAINT "test_templates_id_global_ref_fkey" FOREIGN KEY ("id_global_ref") REFERENCES "public"."test_templates"("id");



ALTER TABLE ONLY "public"."test_templates"
    ADD CONSTRAINT "test_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage organizations" ON "public"."organizations" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."user_role"));



CREATE POLICY "Authenticated users can read organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lab admins can delete org templates" ON "public"."test_templates" FOR DELETE TO "authenticated" USING ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND "public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role")));



CREATE POLICY "Lab admins can insert org templates" ON "public"."test_templates" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND "public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role")));



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



CREATE POLICY "Lab admins can update org templates" ON "public"."test_templates" FOR UPDATE TO "authenticated" USING ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND "public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role"))) WITH CHECK ((("org_id" = ( SELECT "p"."org_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND "public"."has_role"("auth"."uid"(), 'lab_admin'::"public"."user_role")));



CREATE POLICY "Lab admins can update their own organization" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "organizations"."id") AND ("profiles"."role" = ANY (ARRAY['lab_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "organizations"."id")))));



CREATE POLICY "Members of the same org can view each other" ON "public"."profiles" FOR SELECT USING (("org_id" = "public"."get_my_org_id"()));



CREATE POLICY "Public can read exchange rates" ON "public"."exchange_rates" FOR SELECT USING (true);



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



ALTER TABLE "public"."exam_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_templates_junction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_access_pin"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_get_patient_orders"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_role_self_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



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



































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Usuarios autenticados pueden subir logos 1peuqw_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'logos'::text));



  create policy "Usuarios autenticados pueden subir logos 1peuqw_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'logos'::text));



  create policy "Usuarios autenticados pueden subir logos 1peuqw_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'logos'::text));



