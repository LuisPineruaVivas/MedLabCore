import { useMemo } from "react";
import { useUserRole, UserRole } from "./useUserRole";

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
  role: UserRole | null;
  isLoading: boolean;
}

export function usePermissions(): Permissions {
  const { role, isLoading } = useUserRole();

  return useMemo(() => {
    const isAdmin = role === "lab_admin";
    const isBioanalyst = role === "bioanalyst";
    const isSecretary = role === "secretary";

    return {
      // Admin: everything. Bioanalyst: tests yes. Secretary: no.
      canViewTests: isAdmin || isBioanalyst,
      canEditTests: isAdmin,
      // Only admin and bioanalyst can enter results
      canEnterResults: isAdmin || isBioanalyst,
      // Secretary and admin can see billing. Bioanalyst cannot.
      canViewBilling: isAdmin || isSecretary,
      canViewPrices: isAdmin || isSecretary,
      // Everyone can create orders
      canCreateOrders: true,
      // Only admin can access settings
      canViewSettings: isAdmin,
      canManageTeam: isAdmin,
      // Everyone can view visits
      canViewVisits: isAdmin || isBioanalyst || isSecretary,
      role,
      isLoading,
    };
  }, [role, isLoading]);
}
