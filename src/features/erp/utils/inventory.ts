import type { InventoryTransactionType, Item, ItemCategory, UnitOfMeasure } from "../types";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  reagent: "Reactivo",
  consumable: "Consumible",
  equipment_part: "Repuesto de equipo",
  office_supply: "Material de oficina",
  other: "Otro",
};

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  units: "uds",
  boxes: "cajas",
  packs: "paquetes",
  ml: "ml",
  l: "l",
  mg: "mg",
  g: "g",
  kg: "kg",
  tests: "pruebas",
  strips: "tiras",
  other: "otro",
};

export const TRANSACTION_LABELS: Record<InventoryTransactionType, string> = {
  purchase: "Compra",
  consumption: "Consumo",
  adjustment_in: "Ajuste +",
  adjustment_out: "Ajuste −",
  return: "Devolución",
  transfer_in: "Transferencia +",
  transfer_out: "Transferencia −",
  initial: "Inventario inicial",
};

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Mirrors the database trigger: WAC = (stock × cost + qty × newCost) / (stock + qty), rounded to 4 decimals. */
export function computeWac(currentStock: number, currentCost: number, quantity: number, unitCost: number) {
  const newStock = currentStock + quantity;
  if (newStock <= 0) return round(unitCost, 4);
  return round((currentStock * currentCost + quantity * unitCost) / newStock, 4);
}

export function isLowStock(item: Pick<Item, "current_stock" | "min_stock" | "is_active">) {
  return item.is_active && Number(item.min_stock) > 0 && Number(item.current_stock) <= Number(item.min_stock);
}

export function getLowStockItems<T extends Pick<Item, "current_stock" | "min_stock" | "is_active">>(items: T[]) {
  return items.filter(isLowStock);
}

export function totalInventoryValue(items: Pick<Item, "total_value" | "is_active">[]) {
  return round(items.filter((item) => item.is_active).reduce((sum, item) => sum + Number(item.total_value ?? 0), 0), 2);
}

export function formatQuantity(value: number | string | null | undefined, unit?: UnitOfMeasure) {
  const formatted = Number(value ?? 0).toLocaleString("es-VE", { maximumFractionDigits: 4 });
  return unit ? `${formatted} ${UNIT_LABELS[unit]}` : formatted;
}

export function matchesItemSearch(item: Pick<Item, "name" | "code">, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return item.name.toLowerCase().includes(term) || (item.code ?? "").toLowerCase().includes(term);
}
