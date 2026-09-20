import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify caller session and role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is super_admin
    const { data: isSuperAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "super_admin",
    });

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only super_admin can impersonate users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { target_user_id, action = "start" } = await req.json();

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch target user and profile
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, org_id, organizations(name)")
      .eq("id", target_user_id)
      .single();

    if (profileError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch caller profile for audit logging
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", caller.id)
      .single();

    const callerName = callerProfile?.full_name || caller.email || "Super Admin";
    const targetName = targetProfile.full_name || targetProfile.email || "Usuario";
    const targetOrgName = (targetProfile.organizations as { name?: string })?.name || "Sin Organización";

    // 3. Handle Start or End Impersonation Audit Log
    if (action === "end") {
      // Record end of impersonation
      if (targetProfile.org_id) {
        await supabaseAdmin.from("audit_logs").insert({
          org_id: targetProfile.org_id,
          user_id: caller.id,
          user_name: callerName,
          action: "SUPERADMIN_IMPERSONATION_END",
          entity_type: "profiles",
          entity_id: target_user_id,
          metadata: {
            superadmin_id: caller.id,
            superadmin_name: callerName,
            superadmin_email: caller.email,
            impersonated_user_id: target_user_id,
            impersonated_user_name: targetName,
            impersonated_user_email: targetProfile.email,
            impersonated_user_role: targetProfile.role,
            org_id: targetProfile.org_id,
            org_name: targetOrgName,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Impersonation ended" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: "start"
    // Generate magic link / token to sign in as the target user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email!,
    });

    if (linkError || !linkData?.properties?.email_otp) {
      // Fallback: try generating sign-in with recovery token or verify_token if available
      const tokenHash = linkData?.properties?.hashed_token;
      if (!tokenHash && !linkData?.properties?.email_otp) {
        return new Response(
          JSON.stringify({
            error: linkError?.message || "Failed to generate authentication token for target user",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 4. Record START of impersonation in audit_logs
    if (targetProfile.org_id) {
      await supabaseAdmin.from("audit_logs").insert({
        org_id: targetProfile.org_id,
        user_id: caller.id,
        user_name: callerName,
        action: "SUPERADMIN_IMPERSONATION_START",
        entity_type: "profiles",
        entity_id: target_user_id,
        metadata: {
          superadmin_id: caller.id,
          superadmin_name: callerName,
          superadmin_email: caller.email,
          impersonated_user_id: target_user_id,
          impersonated_user_name: targetName,
          impersonated_user_email: targetProfile.email,
          impersonated_user_role: targetProfile.role,
          org_id: targetProfile.org_id,
          org_name: targetOrgName,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: targetProfile.email,
        email_otp: linkData?.properties?.email_otp,
        hashed_token: linkData?.properties?.hashed_token,
        target_user: {
          id: targetProfile.id,
          name: targetName,
          email: targetProfile.email,
          role: targetProfile.role,
          org_id: targetProfile.org_id,
          org_name: targetOrgName,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
