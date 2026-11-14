const amount = (value: number, maximumFractionDigits = 2) =>
  Math.abs(value).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits });

// Intl renders bolívares as "Bs.S" and glues the minus to it ("Bs.S-8.961,23"); the labs write "Bs".
const bolivars = (value: number, maximumFractionDigits = 2) => `${value < 0 ? "-" : ""}Bs ${amount(value, maximumFractionDigits)}`;

export function formatCurrency(value: number | string | null | undefined, currency = "USD") {
  const n = Number(value ?? 0);
  if (currency === "VES") return bolivars(n);
  return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function formatExchangeRate(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Unit costs of supplies are often fractions of a cent: show up to 4 decimals. */
export function formatUnitCost(value: number | string | null | undefined, currency = "USD") {
  const n = Number(value ?? 0);
  if (currency === "VES") return bolivars(n, 4);
  return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
}
