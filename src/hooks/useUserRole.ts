import { useCurrentOrgContext, type UserRole } from "./useCurrentOrgContext";

export type { UserRole };

export function useUserRole() {
  const { role, isLoading } = useCurrentOrgContext();
  return { role, isLoading, isSuperAdmin: role === "super_admin" };
}
