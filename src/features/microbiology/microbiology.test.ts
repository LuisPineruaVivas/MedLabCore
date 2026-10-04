import { describe, expect, it } from "vitest";
import { isMicrobiologyResult, getGermSensitivity, type MicrobiologyResultsData } from "./types";
import {
  initializeResultsState,
  updateMicrobiologyField,
  updateMicrobiologyExtraField,
  updateMicrobiologyCultureMode,
  updateMicrobiologyGerms,
  updateAntibiogramSensitivity,
  addAntibiogramEntry,
  type EditableOrderItem,
} from "@/features/orders/useOrderResultsEditor";
import { testTemplateFormSchema } from "@/features/tests/schemas";

describe("microbiology results data and state helpers", () => {
  it("identifies microbiology results using type guard", () => {
    const microData: MicrobiologyResultsData = {
      result_type: "MICROBIOLOGY",
      sample_type: "Orina",
      gram_stain: "Cocos gram positivos",
      culture_result: "1.- Escherichia coli",
      isolated_germs: ["Escherichia coli"],
      antibiogram: [{ antibiotic_id: "1", antibiotic_name: "Amikacina", sensitivity: "S" }],
    };

    const standardData = {
      sections: [{ id: "1", name: "General", fields: [] }],
    };

    expect(isMicrobiologyResult(microData)).toBe(true);
    expect(isMicrobiologyResult(standardData)).toBe(false);
    expect(isMicrobiologyResult(null)).toBe(false);
  });

  it("initializes microbiology item state with isolated_germs array", () => {
    const items: EditableOrderItem[] = [
      {
        id: "micro-item-1",
        category: "Microbiologia",
        results_data: {
          result_type: "MICROBIOLOGY",
          sample_type: "Secreción",
          gram_stain: "Gram",
          culture_result: "Escherichia coli\nStaphylococcus aureus",
          antibiogram: [],
        },
      },
    ];

    const state = initializeResultsState(items);
    const itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData).toBeDefined();
    expect(itemData.result_type).toBe("MICROBIOLOGY");
    expect(itemData.isolated_germs).toEqual(["Escherichia coli", "Staphylococcus aureus"]);
  });

  it("updates isolated_germs list up to a maximum of 3 germs", () => {
    const initialItems: EditableOrderItem[] = [
      {
        id: "micro-item-1",
        results_data: {
          result_type: "MICROBIOLOGY",
          sample_type: "",
          gram_stain: "",
          isolated_germs: ["Germen 1"],
          antibiogram: [],
        },
      },
    ];

    let state = initializeResultsState(initialItems);
    state = updateMicrobiologyGerms(state, "micro-item-1", ["Germen 1", "Germen 2", "Germen 3", "Germen 4"]);

    const itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData.isolated_germs).toEqual(["Germen 1", "Germen 2", "Germen 3"]);
    expect(itemData.culture_result).toBe("Germen 1\nGermen 2\nGermen 3");
  });

  it("gets and updates sensitivity per germ", () => {
    const initialItems: EditableOrderItem[] = [
      {
        id: "micro-item-1",
        results_data: {
          result_type: "MICROBIOLOGY",
          sample_type: "Orina",
          gram_stain: "",
          isolated_germs: ["Escherichia coli", "Staphylococcus aureus"],
          antibiogram: [
            {
              antibiotic_id: "ab-1",
              antibiotic_name: "Cefuroxime",
              sensitivity: "R",
              sensitivities: { 0: "R" },
            },
          ],
        },
      },
    ];

    let state = initializeResultsState(initialItems);
    // Update germ 2 (index 1) to "S"
    state = updateAntibiogramSensitivity(state, "micro-item-1", 0, "S", 1);

    const itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    const entry = itemData.antibiogram[0];

    expect(getGermSensitivity(entry, 0)).toBe("R");
    expect(getGermSensitivity(entry, 1)).toBe("S");
  });

  it("validates form schema flexibly when result_type is MICROBIOLOGY", () => {
    const validMicrobiologyForm = {
      name: "Cultivo de Orina",
      category: "Microbiologia",
      base_price: 25,
      schema: { sections: [] },
      result_type: "MICROBIOLOGY" as const,
    };

    const parseResult = testTemplateFormSchema.safeParse(validMicrobiologyForm);
    expect(parseResult.success).toBe(true);
  });

  it("handles custom microbiology field definitions and extra_fields updates", () => {
    const customFields = [
      { id: "1", key: "sample_type", label: "Tipo de Muestra Personalizado", fixed: true },
      { id: "2", key: "gram_stain", label: "Examen Directo", fixed: true },
      { id: "3", key: "custom_obs", label: "Observaciones de la Muestra", fixed: false },
    ];

    const initialItems: EditableOrderItem[] = [
      {
        id: "micro-item-1",
        results_data: {
          result_type: "MICROBIOLOGY",
          sample_type: "Heces",
          gram_stain: "Fresco sin hallazgos",
          antibiogram: [],
        },
      },
    ];

    let state = initializeResultsState(initialItems);
    state = updateMicrobiologyExtraField(state, "micro-item-1", "custom_obs", "Muestra purulenta");

    const itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData.extra_fields?.["custom_obs"]).toBe("Muestra purulenta");
  });

  it("toggles culture_mode between text and germs", () => {
    const initialItems: EditableOrderItem[] = [
      {
        id: "micro-item-1",
        results_data: {
          result_type: "MICROBIOLOGY",
          sample_type: "Heces",
          gram_stain: "",
          culture_mode: "text",
          culture_result: "Negativo el desarrollo de gérmenes enteropatógenos",
          isolated_germs: [],
          antibiogram: [],
        },
      },
    ];

    let state = initializeResultsState(initialItems);
    let itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData.culture_mode).toBe("text");

    // Switch to germs mode
    state = updateMicrobiologyCultureMode(state, "micro-item-1", "germs");
    itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData.culture_mode).toBe("germs");
    expect(itemData.isolated_germs).toEqual([""]);

    // Switch back to text mode
    state = updateMicrobiologyCultureMode(state, "micro-item-1", "text");
    itemData = state["micro-item-1"] as unknown as MicrobiologyResultsData;
    expect(itemData.culture_mode).toBe("text");
    expect(itemData.isolated_germs).toEqual([]);
  });
});
