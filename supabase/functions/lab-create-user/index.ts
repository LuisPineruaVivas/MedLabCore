import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Verify caller is lab_admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Check caller is lab_admin or super_admin
    const { data: isLabAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "lab_admin"
    });
    const { data: isSuperAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin"
    });
    if (!isLabAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden: lab_admin or super_admin only"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get caller's org_id
    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("org_id").eq("id", caller.id).single();
    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({
        error: "Missing required fields"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Only allow creating bioanalyst or secretary roles
    if (![
      "bioanalyst",
      "secretary"
    ].includes(role)) {
      return new Response(JSON.stringify({
        error: "Can only create bioanalyst or secretary users"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const orgId = callerProfile?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({
        error: "Caller has no organization"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Create the auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        org_id: orgId
      }
    });
    if (createError) {
      return new Response(JSON.stringify({
        error: createError.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Update the role (trigger sets 'secretary' by default)
    if (role !== "secretary") {
      await supabaseAdmin.from("user_roles").update({
        role
      }).eq("user_id", newUser.user.id);
    }
    // Update profile role
    await supabaseAdmin.from("profiles").update({
      role
    }).eq("id", newUser.user.id);
    return new Response(JSON.stringify({
      user: newUser.user
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({
      error: message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
