import type { CashSessionTotals, PaymentMethodType } from "../types";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  zelle: "Zelle",
  pos_terminal: "Punto de venta",
  other: "Otro",
};

export interface CashReconciliationRow {
  currency: string;
  opening: number;
  cashPayments: number;
  cashExpected: number;
  electronic: number;
  counted: number | null;
  difference: number | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** USD and VES first (the lab's working currencies), then any other code alphabetically. */
export function sortCurrencies(codes: string[]) {
  const priority = ["USD", "VES"];
  return [...new Set(codes)].sort((a, b) => {
    const pa = priority.indexOf(a);
    const pb = priority.indexOf(b);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return a.localeCompare(b);
  });
}

/** Parses a counted amount typed by the operator; accepts "1234.5" and "1234,5". */
export function parseCountInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Compares the physical count against the expected cash (opening fund + cash payments)
 * per currency. Electronic payments are shown but never part of the difference.
 */
export function buildCashReconciliation(
  totals: CashSessionTotals | null | undefined,
  counted: Record<string, number | null | undefined> = {}
): CashReconciliationRow[] {
  const source = totals ?? {};
  return sortCurrencies([...Object.keys(source), ...Object.keys(counted)]).map((currency) => {
    const entry = source[currency];
    const cashExpected = round2(Number(entry?.cash_expected ?? 0));
    const count = counted[currency];
    const hasCount = count !== null && count !== undefined;
    return {
      currency,
      opening: round2(Number(entry?.opening ?? 0)),
      cashPayments: round2(Number(entry?.cash_payments ?? 0)),
      cashExpected,
      electronic: round2(Number(entry?.electronic ?? 0)),
      counted: hasCount ? round2(count) : null,
      difference: hasCount ? round2(count - cashExpected) : null,
    };
  });
}

export function hasCashDifferences(rows: CashReconciliationRow[]) {
  return rows.some((row) => row.difference !== null && Math.abs(row.difference) >= 0.01);
}

export function describeDifference(difference: number | null) {
  if (difference === null) return "Sin conteo";
  if (Math.abs(difference) < 0.01) return "Cuadrada";
  return difference > 0 ? "Sobrante" : "Faltante";
}
