import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

export type UserRole = "super_admin" | "lab_admin" | "bioanalyst" | "secretary";

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

export interface CurrentOrgContext {
  user: ReturnType<typeof useAuth>["user"];
  session: ReturnType<typeof useAuth>["session"];
  profile: Tables<"profiles"> | null;
  organization: Tables<"organizations"> | null;
  orgId: string | null;
  role: UserRole | null;
  permissions: Permissions;
  isLoading: boolean;
}

export function buildPermissions(role: UserRole | null): Permissions {
  const isAdmin = role === "lab_admin";
  const isBioanalyst = role === "bioanalyst";
  const isSecretary = role === "secretary";

  return {
    canViewTests: isAdmin || isBioanalyst,
    canEditTests: isAdmin,
    canEnterResults: isAdmin || isBioanalyst,
    canViewBilling: isAdmin || isSecretary,
    canViewPrices: isAdmin || isSecretary,
    canCreateOrders: true,
    canViewSettings: isAdmin,
    canManageTeam: isAdmin,
    canViewVisits: isAdmin || isBioanalyst || isSecretary,
  };
}

export function useCurrentOrgContext(): CurrentOrgContext {
  const { user, session, loading: authLoading } = useAuth();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, org_id, role, full_name, email, created_at")
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
        .select("id, name, address, phone, email, logo_url, primary_color, secondary_color, city, state, country, rif, is_active, subscription_active, created_at")
        .eq("id", orgId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const role = (profileQuery.data?.role ?? null) as UserRole | null;

  return useMemo(
    () => ({
      user,
      session,
      profile: profileQuery.data ?? null,
      organization: organizationQuery.data ?? null,
      orgId,
      role,
      permissions: buildPermissions(role),
      isLoading: authLoading || profileQuery.isLoading || organizationQuery.isLoading,
    }),
    [
      user,
      session,
      profileQuery.data,
      organizationQuery.data,
      orgId,
      role,
      authLoading,
      profileQuery.isLoading,
      organizationQuery.isLoading,
    ]
  );
}
