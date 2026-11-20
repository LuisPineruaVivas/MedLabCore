import { describe, expect, it } from "vitest";
import { Wallet } from "lucide-react";
import { isEntryActive, isPathActive, type NavGroup } from "./useNavigation";

describe("isPathActive", () => {
  it("matches a page and its sub-pages, not look-alike prefixes", () => {
    expect(isPathActive("/erp/invoices", "/erp/invoices/abc")).toBe(true);
    expect(isPathActive("/orders", "/orders-old")).toBe(false);
    expect(isPathActive("/dashboard", "/")).toBe(true);
  });

  it("treats /erp (the admin home) as exact, since it prefixes every ERP page", () => {
    expect(isPathActive("/erp", "/erp")).toBe(true);
    expect(isPathActive("/erp", "/erp/movements")).toBe(false);
  });
});

describe("isEntryActive", () => {
  const group: NavGroup = {
    label: "Administración",
    icon: Wallet,
    path: "/erp",
    children: [{ label: "Movimientos", icon: Wallet, path: "/erp/movements" }],
  };

  it("marks a section active on any of its pages", () => {
    expect(isEntryActive(group, "/erp/movements")).toBe(true);
    expect(isEntryActive(group, "/erp")).toBe(true);
    expect(isEntryActive(group, "/erp/inventory")).toBe(false);
  });
});
