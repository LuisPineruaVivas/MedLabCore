import { computeWac, formatQuantity, getLowStockItems, isLowStock, matchesItemSearch, toStockUnits, totalInventoryValue } from "./inventory";

describe("inventory calculations", () => {
  it("recalculates the weighted average cost like the plan example", () => {
    // 100 tubes at $0.50 + 50 at $0.60 -> $0.5333
    expect(computeWac(100, 0.5, 50, 0.6)).toBe(0.5333);
  });

  it("uses the purchase cost when the item had no stock", () => {
    expect(computeWac(0, 0, 20, 1.25)).toBe(1.25);
  });

  it("flags active items at or below their minimum", () => {
    expect(isLowStock({ current_stock: 45, min_stock: 50, is_active: true })).toBe(true);
    expect(isLowStock({ current_stock: 50, min_stock: 50, is_active: true })).toBe(true);
    expect(isLowStock({ current_stock: 51, min_stock: 50, is_active: true })).toBe(false);
    expect(isLowStock({ current_stock: 0, min_stock: 0, is_active: true })).toBe(false);
    expect(isLowStock({ current_stock: 1, min_stock: 50, is_active: false })).toBe(false);
  });

  it("lists low-stock items and totals the active inventory value", () => {
    const items = [
      { current_stock: 10, min_stock: 20, is_active: true, total_value: 5.335 },
      { current_stock: 200, min_stock: 100, is_active: true, total_value: 50 },
      { current_stock: 1, min_stock: 5, is_active: false, total_value: 99 },
    ];
    expect(getLowStockItems(items)).toHaveLength(1);
    expect(totalInventoryValue(items)).toBe(55.34);
  });

  it("formats quantities with their unit", () => {
    expect(formatQuantity(12, "ml")).toBe("12 ml");
    expect(formatQuantity(0.5, "units")).toMatch(/^0,5 uds$/);
  });

  it("searches by name or code", () => {
    const item = { name: "Tubo morado EDTA", code: "R-001" };
    expect(matchesItemSearch(item, "edta")).toBe(true);
    expect(matchesItemSearch(item, "r-00")).toBe(true);
    expect(matchesItemSearch(item, "guantes")).toBe(false);
    expect(matchesItemSearch(item, "  ")).toBe(true);
  });

  it("converts purchases entered by package into stock units", () => {
    // 2 packs of 10 syringes at $5 per pack = 20 syringes at $0.50 each.
    expect(toStockUnits(2, 5, 10, true)).toEqual({ quantity: 20, unitCost: 0.5 });
    expect(toStockUnits(2, 5, 10, false)).toEqual({ quantity: 2, unitCost: 5 });
    expect(toStockUnits(3, 9, 1, true)).toEqual({ quantity: 3, unitCost: 9 });
    expect(toStockUnits(1, 10, 3, true)).toEqual({ quantity: 3, unitCost: 3.3333 });
  });
});
