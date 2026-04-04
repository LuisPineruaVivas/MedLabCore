import { describe, expect, it } from "vitest";
import { buildPermissions } from "./useCurrentOrgContext";

describe("buildPermissions", () => {
  it("grants admin capabilities to lab_admin", () => {
    expect(buildPermissions("lab_admin")).toEqual({
      canViewTests: true,
      canEditTests: true,
      canEnterResults: true,
      canViewBilling: true,
      canViewPrices: true,
      canCreateOrders: true,
      canViewSettings: true,
      canManageTeam: true,
      canViewVisits: true,
    });
  });

  it("limits bioanalyst access to tests/results/visits", () => {
    expect(buildPermissions("bioanalyst")).toEqual({
      canViewTests: true,
      canEditTests: false,
      canEnterResults: true,
      canViewBilling: false,
      canViewPrices: false,
      canCreateOrders: true,
      canViewSettings: false,
      canManageTeam: false,
      canViewVisits: true,
    });
  });

  it("keeps secretary focused on front-desk flows", () => {
    expect(buildPermissions("secretary")).toEqual({
      canViewTests: false,
      canEditTests: false,
      canEnterResults: false,
      canViewBilling: true,
      canViewPrices: true,
      canCreateOrders: true,
      canViewSettings: false,
      canManageTeam: false,
      canViewVisits: true,
    });
  });
});
