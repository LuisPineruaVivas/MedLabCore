import { parseAmount, parseBillingTotals } from "./billingUtils";

describe("billing totals from the database", () => {
  it("maps the RPC result to the page fields", () => {
    expect(parseBillingTotals({ total_revenue: 3000.5, this_month_revenue: "50.25", pending_count: 300 })).toEqual({
      totalRevenue: 3000.5,
      thisMonthRevenue: 50.25,
      pendingCount: 300,
    });
  });

  it("falls back to zeros on missing or malformed data", () => {
    expect(parseBillingTotals(null)).toEqual({ totalRevenue: 0, thisMonthRevenue: 0, pendingCount: 0 });
    expect(parseBillingTotals({ total_revenue: "abc" }).totalRevenue).toBe(0);
  });

  it("parses numeric amounts that arrive as strings", () => {
    expect(parseAmount("1100.00")).toBe(1100);
    expect(parseAmount(null)).toBe(0);
  });
});
