import { describe, expect, it } from "vitest";
import { buildPermissions, computeSubscriptionStatus, type OrgWithSubscription } from "./useCurrentOrgContext";

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
      canViewSettings: true,
      canManageTeam: false,
      canViewVisits: true,
    });
  });

  it("keeps secretary focused on front-desk flows", () => {
    expect(buildPermissions("secretary")).toEqual({
      canViewTests: false,
      canEditTests: false,
      canEnterResults: true,
      canViewBilling: true,
      canViewPrices: true,
      canCreateOrders: true,
      canViewSettings: false,
      canManageTeam: false,
      canViewVisits: true,
    });
  });

  it("keeps lab affiliates restricted to patients and orders", () => {
    expect(buildPermissions("lab_affiliate")).toEqual({
      canViewTests: false,
      canEditTests: false,
      canEnterResults: false,
      canViewBilling: false,
      canViewPrices: false,
      canCreateOrders: true,
      canViewSettings: false,
      canManageTeam: false,
      canViewVisits: false,
    });
  });
});

describe("computeSubscriptionStatus", () => {
  const baseOrg = {
    id: "org-123",
    name: "Lab Test",
    subscription_active: true,
  } as OrgWithSubscription;

  it("super_admin is never blocked or expired", () => {
    const status = computeSubscriptionStatus(
      { ...baseOrg, subscription_expires_at: "2020-01-01T00:00:00Z" },
      "super_admin"
    );
    expect(status.isBlocked).toBe(false);
    expect(status.isExpired).toBe(false);
  });

  it("detects active subscription with > 3 days left", () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const status = computeSubscriptionStatus(
      { ...baseOrg, subscription_expires_at: futureDate },
      "lab_admin"
    );
    expect(status.isActive).toBe(true);
    expect(status.isExpired).toBe(false);
    expect(status.isWarning).toBe(false);
    expect(status.isBlocked).toBe(false);
  });

  it("triggers warning banner when <= 3 days left", () => {
    const warningDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const status = computeSubscriptionStatus(
      { ...baseOrg, subscription_expires_at: warningDate },
      "lab_admin"
    );
    expect(status.isActive).toBe(true);
    expect(status.isExpired).toBe(false);
    expect(status.isWarning).toBe(true);
    expect(status.isBlocked).toBe(false);
  });

  it("allows access during grace period even if expired", () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const graceDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const status = computeSubscriptionStatus(
      {
        ...baseOrg,
        subscription_expires_at: pastDate,
        subscription_grace_until: graceDate,
      },
      "lab_admin"
    );
    expect(status.isExpired).toBe(true);
    expect(status.isInGrace).toBe(true);
    expect(status.isBlocked).toBe(false);
    expect(status.isActive).toBe(true);
  });

  it("blocks laboratory when expired and grace period passed", () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const pastGrace = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const status = computeSubscriptionStatus(
      {
        ...baseOrg,
        subscription_expires_at: pastDate,
        subscription_grace_until: pastGrace,
      },
      "lab_admin"
    );
    expect(status.isExpired).toBe(true);
    expect(status.isInGrace).toBe(false);
    expect(status.isBlocked).toBe(true);
    expect(status.isActive).toBe(false);
  });
});
