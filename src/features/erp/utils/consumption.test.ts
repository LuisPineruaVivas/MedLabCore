import {
  buildConsumptionDraft,
  buildExtraLine,
  duplicateExamLines,
  linesMissingReason,
  summarizeConsumption,
  toConsumptionInputs,
} from "./consumption";
import type { BomPreviewLine, Item } from "../types";

const preview: BomPreviewLine[] = [
  { order_item_id: "oi-1", test_name: "Hematología", item_id: "tube", item_name: "Tubo morado", item_code: "R-001", unit_of_measure: "units", quantity: 1, unit_cost: 0.53, current_stock: 45 },
  { order_item_id: "oi-1", test_name: "Hematología", item_id: "lancet", item_name: "Lanceta", item_code: null, unit_of_measure: "units", quantity: 1, unit_cost: 0.1, current_stock: 1 },
  { order_item_id: "oi-2", test_name: "Glicemia", item_id: "tube", item_name: "Tubo morado", item_code: "R-001", unit_of_measure: "units", quantity: 1, unit_cost: 0.53, current_stock: 45 },
];

describe("order consumption", () => {
  it("pre-fills one line per exam and supply from the recipes", () => {
    const lines = buildConsumptionDraft(preview);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ key: "oi-1:tube", quantity: 1, recipe_quantity: 1, is_extra: false });
  });

  it("aggregates totals per supply and detects missing stock", () => {
    const summary = summarizeConsumption(duplicateExamLines(buildConsumptionDraft(preview), "oi-1", 1));
    const tube = summary.rows.find((row) => row.item_id === "tube");
    const lancet = summary.rows.find((row) => row.item_id === "lancet");
    expect(tube).toMatchObject({ quantity: 3, total: 1.59, shortage: 0 });
    expect(lancet).toMatchObject({ quantity: 2, shortage: 1 });
    expect(summary.totalCost).toBe(1.79);
    expect(summary.hasShortage).toBe(true);
  });

  it("marks repeated exams as extras with a reason", () => {
    const lines = duplicateExamLines(buildConsumptionDraft(preview), "oi-2", 7);
    const copy = lines[lines.length - 1];
    expect(copy).toMatchObject({ key: "oi-2:tube:repeat:7", is_extra: true, recipe_quantity: null, reason: "Repetición de examen" });
  });

  it("builds the RPC payload, flagging adjustments and dropping zero lines", () => {
    const lines = buildConsumptionDraft(preview);
    lines[0].quantity = 2;
    lines[0].reason = "Se rompió un tubo";
    lines[1].quantity = 0;
    const payload = toConsumptionInputs(lines);
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({ item_id: "tube", quantity: 2, was_adjusted: true, order_item_id: "oi-1", reason: "Se rompió un tubo" });
    expect(payload[1]).toMatchObject({ item_id: "tube", was_adjusted: false, reason: null });
  });

  it("requires a reason for adjusted and extra lines", () => {
    const item = { id: "gloves", name: "Guantes", unit_of_measure: "boxes", unit_cost: 12, current_stock: 5 } as Item;
    const lines = [...buildConsumptionDraft(preview), { ...buildExtraLine(item, 1), reason: "" }];
    lines[0].quantity = 3;
    expect(linesMissingReason(lines).map((line) => line.key)).toEqual(["oi-1:tube", "extra:gloves:1"]);
  });
});
