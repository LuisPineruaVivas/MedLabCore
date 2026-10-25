export function formatCurrency(value: number | string | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value ?? 0));
}

export function formatExchangeRate(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Unit costs of supplies are often fractions of a cent: show up to 4 decimals. */
export function formatUnitCost(value: number | string | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value ?? 0));
}
