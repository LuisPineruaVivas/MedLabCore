import { describe, expect, it } from "vitest";
import {
  buildAppendedText,
  groupEditableOrderItems,
  initializeResultsState,
  updateResultsField,
  type EditableOrderItem,
} from "./useOrderResultsEditor";

const baseResults = {
  sections: [
    {
      id: "section-1",
      name: "General",
      fields: [
        { id: "field-1", label: "Glucosa", type: "number" as const, value: "" },
        { id: "field-2", label: "Comentario", type: "text" as const, value: "" },
      ],
    },
  ],
};

function buildItems(): EditableOrderItem[] {
  return [
    { id: "item-1", category: "Bioquimica", is_profile_header: false, results_data: structuredClone(baseResults) },
    { id: "item-2", category: "Hematologia", is_profile_header: false, results_data: JSON.stringify(baseResults) },
    { id: "item-3", category: "Bioquimica", is_profile_header: true, results_data: structuredClone(baseResults) },
  ];
}

describe("order results editor helpers", () => {
  it("initializes editable state from object and JSON results", () => {
    const state = initializeResultsState(buildItems());
    expect(Object.keys(state)).toEqual(["item-1", "item-2", "item-3"]);
    expect(state["item-2"].sections?.[0].fields?.[0].label).toBe("Glucosa");
  });

  it("groups only editable items by category", () => {
    const grouped = groupEditableOrderItems(buildItems());
    expect(Object.keys(grouped)).toEqual(["Bioquimica", "Hematologia"]);
    expect(grouped.Bioquimica).toHaveLength(1);
  });

  it("updates a nested field value immutably", () => {
    const initial = initializeResultsState(buildItems());
    const next = updateResultsField(initial, "item-1", 0, 0, "95");
    expect(next["item-1"].sections?.[0].fields?.[0].value).toBe("95");
    expect(initial["item-1"].sections?.[0].fields?.[0].value).toBe("");
  });

  it("appends text options without losing previous content", () => {
    expect(buildAppendedText("Paciente estable", "Normal")).toBe("Paciente estable Normal");
    expect(buildAppendedText("", "Normal")).toBe("Normal");
    expect(buildAppendedText("Muestra: Suero", "Resultado: Negativo\nGen: No detectado")).toBe(
      "Muestra: Suero\n\nResultado: Negativo\nGen: No detectado"
    );
  });
});
