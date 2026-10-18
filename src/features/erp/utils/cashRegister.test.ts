import { buildCashReconciliation, describeDifference, hasCashDifferences, parseCountInput, sortCurrencies } from "./cashRegister";
import { getErpErrorMessage } from "./erpErrors";
import type { CashSessionTotals } from "../types";

const totals: CashSessionTotals = {
  VES: { opening: 100, cash_payments: 400, cash_expected: 500, electronic: 0, total_received: 400, count: 1, by_method: [] },
  USD: { opening: 20, cash_payments: 30, cash_expected: 50, electronic: 20, total_received: 50, count: 2, by_method: [] },
};

describe("cash register reconciliation", () => {
  it("orders USD and VES before other currencies", () => {
    expect(sortCurrencies(["EUR", "VES", "COP", "USD", "VES"])).toEqual(["USD", "VES", "COP", "EUR"]);
  });

  it("compares the count only against expected cash", () => {
    const rows = buildCashReconciliation(totals, { USD: 50, VES: 490 });
    expect(rows.map((row) => row.currency)).toEqual(["USD", "VES"]);
    expect(rows[0]).toMatchObject({ cashExpected: 50, electronic: 20, counted: 50, difference: 0 });
    expect(rows[1]).toMatchObject({ cashExpected: 500, counted: 490, difference: -10 });
    expect(hasCashDifferences(rows)).toBe(true);
  });

  it("leaves the difference empty until a count is entered", () => {
    const rows = buildCashReconciliation(totals, { USD: null });
    expect(rows[0].difference).toBeNull();
    expect(hasCashDifferences(rows)).toBe(false);
  });

  it("includes currencies that were counted but had no movements", () => {
    const rows = buildCashReconciliation(totals, { EUR: 5 });
    expect(rows.find((row) => row.currency === "EUR")).toMatchObject({ cashExpected: 0, difference: 5 });
  });

  it("parses counted amounts with comma or dot and rejects invalid input", () => {
    expect(parseCountInput("120,50")).toBe(120.5);
    expect(parseCountInput(" 80 ")).toBe(80);
    expect(parseCountInput("")).toBeNull();
    expect(parseCountInput("-1")).toBeNull();
    expect(parseCountInput("abc")).toBeNull();
  });

  it("labels the difference", () => {
    expect(describeDifference(null)).toBe("Sin conteo");
    expect(describeDifference(0.004)).toBe("Cuadrada");
    expect(describeDifference(3)).toBe("Sobrante");
    expect(describeDifference(-3)).toBe("Faltante");
  });
});

describe("ERP error messages", () => {
  it("translates RPC error codes, including ones with details", () => {
    expect(getErpErrorMessage(new Error("CASH_SESSION_ALREADY_OPEN"))).toBe("Ya hay una caja abierta en este laboratorio.");
    expect(getErpErrorMessage({ message: "INSUFFICIENT_STOCK: Tubo (stock 1, solicitado 3)" })).toBe("No hay stock suficiente del insumo: Tubo (stock 1, solicitado 3)");
  });

  it("keeps unknown messages", () => {
    expect(getErpErrorMessage(new Error("Network down"))).toBe("Network down");
  });
});
