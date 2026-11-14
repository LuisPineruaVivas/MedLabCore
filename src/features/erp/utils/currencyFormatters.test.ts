import { describe, expect, it } from "vitest";
import { formatCurrency, formatUnitCost } from "./currencyFormatters";

describe("formatCurrency", () => {
  it("writes bolívares as Bs with the sign before the symbol", () => {
    expect(formatCurrency(-8961.23, "VES")).toBe("-Bs 8.961,23");
    expect(formatCurrency(44800, "VES")).toBe("Bs 44.800,00");
    expect(formatUnitCost(0.5333, "VES")).toBe("Bs 0,5333");
  });

  it("keeps dollars on Intl", () => {
    expect(formatCurrency(15, "USD")).toMatch(/15,00/);
  });
});
