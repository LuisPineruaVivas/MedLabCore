import type { FinanceEntryKind } from "../types";

export const FINANCE_KIND_LABELS: Record<FinanceEntryKind, string> = {
  order_payment: "Cobro de orden",
  income: "Ingreso",
  expense: "Gasto",
  transfer_in: "Transferencia recibida",
  transfer_out: "Transferencia enviada",
  adjustment_in: "Ajuste (entrada)",
  adjustment_out: "Ajuste (salida)",
};

/** Filter options of the movements list; "transfer" and "adjustment" group both directions. */
export const FINANCE_KIND_FILTERS: { value: string; label: string; adminOnly?: boolean }[] = [
  { value: "order_payment", label: "Cobros de órdenes" },
  { value: "income", label: "Otros ingresos" },
  { value: "expense", label: "Gastos" },
  { value: "transfer", label: "Transferencias", adminOnly: true },
  { value: "adjustment", label: "Ajustes", adminOnly: true },
];

/** Today in the browser's time zone, as yyyy-MM-dd (the labs run on Caracas time). */
export const todayIso = () => new Date().toLocaleDateString("en-CA");

/**
 * Rate implied by a transfer between currencies, as local units per USD (what the server stores).
 * Null when the currencies match, an amount is missing, or neither side is USD (not supported).
 */
export function transferRate(fromCurrency: string, fromAmount: number, toCurrency: string, toAmount: number) {
  if (fromCurrency === toCurrency || !(fromAmount > 0) || !(toAmount > 0)) return null;
  if (fromCurrency === "USD") return toAmount / fromAmount;
  if (toCurrency === "USD") return fromAmount / toAmount;
  return null;
}

/** USD equivalent of an amount in a local currency at a rate (local per USD). */
export function toUsd(currency: string, amount: number, rate: number | null | undefined) {
  if (currency === "USD") return amount;
  return rate && rate > 0 ? Math.round((amount / rate) * 100) / 100 : null;
}

/**
 * Amount to pay, in the account's currency, to settle `remaining` of a bill in `billCurrency`.
 * rate is local units per USD. Null when a needed rate is missing or neither side is USD.
 */
export function amountInAccountCurrency(billCurrency: string, remaining: number, accountCurrency: string, rate: number | null | undefined) {
  if (billCurrency === accountCurrency) return remaining;
  if (!rate || rate <= 0) return null;
  if (billCurrency === "USD") return Math.round(remaining * rate * 100) / 100;
  if (accountCurrency === "USD") return Math.round((remaining / rate) * 100) / 100;
  return null;
}

export const PAYABLE_STATUS_LABELS = { pending: "Pendiente", partial: "Abonada", paid: "Pagada", cancelled: "Anulada" } as const;

/** Open and past its due date (today's bills are not overdue yet). */
export const isOverdue = (dueDate: string | null, status: string, today = todayIso()) =>
  !!dueDate && dueDate < today && (status === "pending" || status === "partial");

/** Bolívar balances valued at today's live rate (the stored history can be days old). */
export function withLiveUsd<T extends { currency: string; balance: number; balance_usd: number | null }>(balances: T[], liveRate: number | null | undefined): T[] {
  if (!liveRate) return balances;
  return balances.map((item) => (item.currency === "VES" ? { ...item, balance_usd: Math.round((Number(item.balance) / liveRate) * 100) / 100 } : item));
}

/** "2026-11" → "nov 26". */
export function formatMonthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("es-VE", { month: "short", year: "2-digit" });
}

export type InstallmentFrequency = "weekly" | "biweekly" | "monthly" | "custom";

export const INSTALLMENT_FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal (cada 15 días)",
  monthly: "Mensual",
  custom: "Personalizado",
};

/** Due date of installment `index` (0-based) counted from `first` ("YYYY-MM-DD"). Monthly keeps the day, or the month's last day. */
export function installmentDueDate(first: string, index: number, frequency: Exclude<InstallmentFrequency, "custom">) {
  const [year, month, day] = first.split("-").map(Number);
  if (frequency !== "monthly") {
    const date = new Date(Date.UTC(year, month - 1, day + index * (frequency === "weekly" ? 7 : 15)));
    return date.toISOString().slice(0, 10);
  }
  const lastDay = new Date(Date.UTC(year, month + index, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + index, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** Splits `balance` into `count` installments; the last one absorbs the rounding. */
export function splitInstallments(balance: number, count: number) {
  const base = Number((balance / count).toFixed(2));
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? Number((balance - base * (count - 1)).toFixed(2)) : base,
  );
}

/** "Vencida hace 3 días" / "Hoy" / "Mañana" / "En 5 días", comparing yyyy-MM-dd dates. */
export function dueLabel(dueDate: string, today = todayIso()) {
  const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000);
  if (days < 0) return days === -1 ? "Vencida ayer" : `Vencida hace ${-days} días`;
  if (days === 0) return "Vence hoy";
  return days === 1 ? "Vence mañana" : `En ${days} días`;
}

