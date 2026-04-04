import { useCurrentOrgContext, type Permissions as BasePermissions, type UserRole } from "./useCurrentOrgContext";

export interface Permissions extends BasePermissions {
  role: UserRole | null;
  isLoading: boolean;
}

export function usePermissions(): Permissions {
  const { permissions, role, isLoading } = useCurrentOrgContext();
  return {
    ...permissions,
    role,
    isLoading,
  };
}
