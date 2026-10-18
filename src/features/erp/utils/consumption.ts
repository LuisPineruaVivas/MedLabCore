import type { BomPreviewLine, ConsumptionInput, Item, UnitOfMeasure } from "../types";

/** Editable line of the consumption confirmation dialog. */
export interface ConsumptionDraftLine {
  key: string;
  item_id: string;
  item_name: string;
  unit_of_measure: UnitOfMeasure;
  unit_cost: number;
  current_stock: number;
  order_item_id: string | null;
  test_name: string | null;
  /** Quantity from the recipe; null for lines the user added. */
  recipe_quantity: number | null;
  quantity: number;
  is_extra: boolean;
  reason: string;
}

export interface ConsumptionSummaryRow {
  item_id: string;
  item_name: string;
  unit_of_measure: UnitOfMeasure;
  quantity: number;
  unit_cost: number;
  total: number;
  current_stock: number;
  shortage: number;
}

const round = (value: number, decimals = 4) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export function buildConsumptionDraft(preview: BomPreviewLine[]): ConsumptionDraftLine[] {
  return preview.map((line) => ({
    key: `${line.order_item_id}:${line.item_id}`,
    item_id: line.item_id,
    item_name: line.item_name,
    unit_of_measure: line.unit_of_measure,
    unit_cost: Number(line.unit_cost),
    current_stock: Number(line.current_stock),
    order_item_id: line.order_item_id,
    test_name: line.test_name,
    recipe_quantity: Number(line.quantity),
    quantity: Number(line.quantity),
    is_extra: false,
    reason: "",
  }));
}

/** Repeating an exam consumes its recipe again: appends a copy of its lines as extras. */
export function duplicateExamLines(lines: ConsumptionDraftLine[], orderItemId: string, keySuffix: string | number) {
  const copies = lines
    .filter((line) => line.order_item_id === orderItemId && !line.is_extra)
    .map((line) => ({ ...line, key: `${line.key}:repeat:${keySuffix}`, recipe_quantity: null, is_extra: true, reason: "Repetición de examen" }));
  return [...lines, ...copies];
}

export function buildExtraLine(item: Item, keySuffix: string | number, reason = "Gasto imprevisto"): ConsumptionDraftLine {
  return {
    key: `extra:${item.id}:${keySuffix}`,
    item_id: item.id,
    item_name: item.name,
    unit_of_measure: item.unit_of_measure,
    unit_cost: Number(item.unit_cost),
    current_stock: Number(item.current_stock),
    order_item_id: null,
    test_name: null,
    recipe_quantity: null,
    quantity: 1,
    is_extra: true,
    reason,
  };
}

/** Totals per supply across all exams, with how much stock is missing (if any). */
export function summarizeConsumption(lines: ConsumptionDraftLine[]) {
  const byItem = new Map<string, ConsumptionSummaryRow>();
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    if (quantity <= 0) continue;
    const row = byItem.get(line.item_id) ?? {
      item_id: line.item_id,
      item_name: line.item_name,
      unit_of_measure: line.unit_of_measure,
      quantity: 0,
      unit_cost: line.unit_cost,
      total: 0,
      current_stock: line.current_stock,
      shortage: 0,
    };
    row.quantity = round(row.quantity + quantity);
    row.total = round(row.quantity * row.unit_cost);
    row.shortage = round(Math.max(row.quantity - row.current_stock, 0));
    byItem.set(line.item_id, row);
  }
  const rows = [...byItem.values()].sort((a, b) => a.item_name.localeCompare(b.item_name));
  return {
    rows,
    totalCost: Math.round(rows.reduce((sum, row) => sum + row.total, 0) * 100) / 100,
    hasShortage: rows.some((row) => row.shortage > 0),
  };
}

/** Payload for `confirm_order_consumption`; zero quantities mean "not consumed" and are dropped. */
export function toConsumptionInputs(lines: ConsumptionDraftLine[]): ConsumptionInput[] {
  return lines
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({
      item_id: line.item_id,
      quantity: Number(line.quantity),
      order_item_id: line.order_item_id,
      was_adjusted: line.recipe_quantity !== null && Number(line.quantity) !== line.recipe_quantity,
      is_extra: line.is_extra,
      reason: line.reason.trim() || null,
    }));
}

/** Adjusted or extra lines must explain why, so the Kardex keeps a reason. */
export function linesMissingReason(lines: ConsumptionDraftLine[]) {
  return lines.filter((line) => {
    const changed = line.is_extra || (line.recipe_quantity !== null && Number(line.quantity) !== line.recipe_quantity);
    return changed && !line.reason.trim();
  });
}
