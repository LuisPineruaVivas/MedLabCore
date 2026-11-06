import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import type { SubscriptionStatusInfo } from "@/types/subscription";

export type UserRole = "super_admin" | "lab_admin" | "bioanalyst" | "secretary" | "lab_affiliate";

export interface Permissions {
  canViewTests: boolean;
  canEditTests: boolean;
  canEnterResults: boolean;
  canViewBilling: boolean;
  canViewPrices: boolean;
  canCreateOrders: boolean;
  canViewSettings: boolean;
  canManageTeam: boolean;
  canViewVisits: boolean;
}

export type OrgWithSubscription = Tables<"organizations"> & {
  subscription_expires_at?: string | null;
  subscription_grace_until?: string | null;
  subscription_plan_price?: number | null;
};

export interface CurrentOrgContext {
  user: ReturnType<typeof useAuth>["user"];
  session: ReturnType<typeof useAuth>["session"];
  profile: Tables<"profiles"> | null;
  organization: OrgWithSubscription | null;
  orgId: string | null;
  role: UserRole | null;
  permissions: Permissions;
  subscriptionStatus: SubscriptionStatusInfo;
  isLoading: boolean;
}

export function buildPermissions(role: UserRole | null): Permissions {
  const isAdmin = role === "lab_admin";
  const isBioanalyst = role === "bioanalyst";
  const isSecretary = role === "secretary";

  return {
    canViewTests: isAdmin || isBioanalyst,
    canEditTests: isAdmin,
    canEnterResults: isAdmin || isBioanalyst || isSecretary,
    canViewBilling: isAdmin || isSecretary,
    canViewPrices: isAdmin || isSecretary,
    canCreateOrders: true,
    canViewSettings: isAdmin || isBioanalyst,
    canManageTeam: isAdmin,
    canViewVisits: isAdmin || isBioanalyst || isSecretary,
  };
}

export function computeSubscriptionStatus(
  org: OrgWithSubscription | null,
  role: UserRole | null
): SubscriptionStatusInfo {
  if (!org || role === "super_admin") {
    return {
      expiresAt: org?.subscription_expires_at ?? null,
      graceUntil: org?.subscription_grace_until ?? null,
      isActive: true,
      isExpired: false,
      isInGrace: false,
      isWarning: false,
      daysRemaining: 999,
      hoursRemaining: 9999,
      isBlocked: false,
      statusText: "Super Admin",
    };
  }

  const now = new Date();
  const expiresAt = org.subscription_expires_at ? new Date(org.subscription_expires_at) : null;
  const graceUntil = org.subscription_grace_until ? new Date(org.subscription_grace_until) : null;

  const isInGrace = Boolean(graceUntil && graceUntil.getTime() > now.getTime());
  const isExpired = Boolean(!expiresAt || expiresAt.getTime() <= now.getTime());

  // Target date for remaining countdown
  const targetDate = isExpired && isInGrace ? graceUntil! : (expiresAt ?? now);
  const diffMs = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  // Warning when expiring in 3 days or less and not yet expired
  const isWarning = !isExpired && diffMs > 0 && diffMs <= 3 * 24 * 60 * 60 * 1000;

  // Blocked when expired and grace period ended or does not exist
  const isBlocked = isExpired && !isInGrace;

  let statusText = "Activa";
  if (isBlocked) {
    statusText = "Vencida";
  } else if (isInGrace) {
    statusText = "En período de gracia (3 días)";
  } else if (isWarning) {
    statusText = `Por vencer (${daysRemaining === 0 ? "hoy" : `${daysRemaining} día(s)`})`;
  }

  return {
    expiresAt: org.subscription_expires_at ?? null,
    graceUntil: org.subscription_grace_until ?? null,
    isActive: !isBlocked,
    isExpired,
    isInGrace,
    isWarning,
    daysRemaining,
    hoursRemaining,
    isBlocked,
    statusText,
  };
}

export function useCurrentOrgContext(): CurrentOrgContext {
  const { user, session, loading: authLoading } = useAuth();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, org_id, role, full_name, email, created_at, firma_url, sello_url, signature_footer_text, onboarding_completed_at")
        .eq("id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const orgId = profileQuery.data?.org_id ?? null;

  const organizationQuery = useQuery({
    queryKey: queryKeys.organization(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, address, phone, email, logo_url, watermark_url, primary_color, secondary_color, report_template, report_footer_text, city, state, country, rif, is_active, subscription_active, subscription_expires_at, subscription_grace_until, subscription_plan_price, created_at, profiles!inner (role, full_name, email)")
        .eq("id", orgId!)
        .eq("profiles.role", "lab_admin")
        .single();

      if (error) throw error;
      return data as OrgWithSubscription;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const role = (profileQuery.data?.role ?? null) as UserRole | null;
  const org = (organizationQuery.data ?? null) as OrgWithSubscription | null;
  const subscriptionStatus = useMemo(() => computeSubscriptionStatus(org, role), [org, role]);

  return useMemo(
    () => ({
      user,
      session,
      profile: profileQuery.data ?? null,
      organization: org,
      orgId,
      role,
      permissions: buildPermissions(role),
      subscriptionStatus,
      isLoading: authLoading || profileQuery.isLoading || organizationQuery.isLoading,
    }),
    [
      user,
      session,
      profileQuery.data,
      org,
      orgId,
      role,
      subscriptionStatus,
      authLoading,
      profileQuery.isLoading,
      organizationQuery.isLoading,
    ]
  );
}
