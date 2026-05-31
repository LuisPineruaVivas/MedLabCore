import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      org_name,
      country,
      state,
      city,
      address,
      admin_email,
      admin_password,
      admin_full_name,
    } = await req.json();

    if (!org_name || !admin_email || !admin_password || !admin_full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_name, admin_email, admin_password, admin_full_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create the organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: org_name,
        country: country || null,
        state: state || null,
        city: city || null,
        address: address || null,
      })
      .select()
      .single();

    if (orgError) {
      return new Response(JSON.stringify({ error: `Org creation failed: ${orgError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create the admin user (the trigger will create profile + user_roles with defaults)
    const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { full_name: admin_full_name, org_id: org.id },
    });

    if (userError) {
      // Rollback: delete the org we just created
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `User creation failed: ${userError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Update role to lab_admin (trigger defaults to secretary)
    //await supabaseAdmin
    //  .from("user_roles")
    //  .update({ role: "lab_admin" })
    //  .eq("user_id", newUser.user.id);

    await supabaseAdmin
      .from("profiles")
      .update({ role: "lab_admin" })
      .eq("id", newUser.user.id);

    return new Response(
      JSON.stringify({ organization: org, user: { id: newUser.user.id, email: newUser.user.email } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
