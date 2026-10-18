import { useCurrentOrgContext, type UserRole } from "./useCurrentOrgContext";
import { useUserRole } from "./useUserRole";

export interface ErpModulePermissions {
  isErpEnabled: boolean;
  canManageFinances: boolean;
  canManageInventory: boolean;
  canRegisterPayments: boolean;
  canViewFinancialReports: boolean;
  canConfirmConsumption: boolean;
  canManageCashRegister: boolean;
  canManageSuppliers: boolean;
}

export function buildErpPermissions(
  isErpEnabled: boolean,
  role: UserRole | string | null,
  isSuperAdmin = false
): ErpModulePermissions {
  if (!isErpEnabled) {
    return {
      isErpEnabled: false,
      canManageFinances: false,
      canManageInventory: false,
      canRegisterPayments: false,
      canViewFinancialReports: false,
      canConfirmConsumption: false,
      canManageCashRegister: false,
      canManageSuppliers: false,
    };
  }

  const isAdmin = role === "lab_admin" || isSuperAdmin;
  const isBioanalyst = role === "bioanalyst";
  const isSecretary = role === "secretary";

  return {
    isErpEnabled: true,
    canManageFinances: isAdmin,
    canManageInventory: isAdmin || isBioanalyst,
    canRegisterPayments: isAdmin || isSecretary,
    canViewFinancialReports: isAdmin,
    canConfirmConsumption: isAdmin || isBioanalyst,
    canManageCashRegister: isAdmin || isSecretary,
    canManageSuppliers: isAdmin,
  };
}

export function useErpModule(): ErpModulePermissions {
  const { organization, role } = useCurrentOrgContext();
  const { isSuperAdmin } = useUserRole();

  const isErpEnabled = Boolean(organization?.has_erp_module);

  return buildErpPermissions(isErpEnabled, role, isSuperAdmin);
}
