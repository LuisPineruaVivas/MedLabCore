export interface BillingTotals {
  totalRevenue: number;
  thisMonthRevenue: number;
  pendingCount: number;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Maps the `get_billing_totals` RPC result to the fields the billing page shows. */
export function parseBillingTotals(raw: unknown): BillingTotals {
  const totals = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    totalRevenue: toNumber(totals.total_revenue),
    thisMonthRevenue: toNumber(totals.this_month_revenue),
    pendingCount: toNumber(totals.pending_count),
  };
}

/** `get_affiliate_pending_balance` returns a Postgres numeric, which may arrive as a string. */
export function parseAmount(raw: unknown): number {
  return toNumber(raw);
}
