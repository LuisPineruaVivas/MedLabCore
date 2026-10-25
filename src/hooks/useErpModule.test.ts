import { describe, expect, it } from "vitest";
import { buildErpPermissions } from "./useErpModule";

describe("buildErpPermissions", () => {
  it("retorna todo false cuando isErpEnabled es false", () => {
    const permissions = buildErpPermissions(false, "lab_admin", false);

    expect(permissions).toEqual({
      isErpEnabled: false,
      canManageFinances: false,
      canManageInventory: false,
      canRegisterPayments: false,
      canViewFinancialReports: false,
      canConfirmConsumption: false,
      canManageCashRegister: false,
      canManageSuppliers: false,
    });
  });

  it("otorga permisos administrativos y financieros completos a lab_admin cuando ERP está activo", () => {
    const permissions = buildErpPermissions(true, "lab_admin", false);

    expect(permissions).toEqual({
      isErpEnabled: true,
      canManageFinances: true,
      canManageInventory: true,
      canRegisterPayments: true,
      canViewFinancialReports: true,
      canConfirmConsumption: true,
      canManageCashRegister: true,
      canManageSuppliers: true,
    });
  });

  it("permite gestión de inventario y confirmación de consumo a bioanalyst pero restringe finanzas", () => {
    const permissions = buildErpPermissions(true, "bioanalyst", false);

    expect(permissions).toEqual({
      isErpEnabled: true,
      canManageFinances: false,
      canManageInventory: true,
      canRegisterPayments: false,
      canViewFinancialReports: false,
      canConfirmConsumption: true,
      canManageCashRegister: false,
      canManageSuppliers: false,
    });
  });

  it("permite cobro de pagos y caja a secretaria con ERP activo pero restringe inventario", () => {
    const permissions = buildErpPermissions(true, "secretary", false);

    expect(permissions).toEqual({
      isErpEnabled: true,
      canManageFinances: false,
      canManageInventory: false,
      canRegisterPayments: true,
      canViewFinancialReports: false,
      canConfirmConsumption: false,
      canManageCashRegister: true,
      canManageSuppliers: false,
    });
  });

  it("otorga acceso total a super_admin cuando ERP está activo", () => {
    const permissions = buildErpPermissions(true, "super_admin", true);

    expect(permissions).toEqual({
      isErpEnabled: true,
      canManageFinances: true,
      canManageInventory: true,
      canRegisterPayments: true,
      canViewFinancialReports: true,
      canConfirmConsumption: true,
      canManageCashRegister: true,
      canManageSuppliers: true,
    });
  });
});
