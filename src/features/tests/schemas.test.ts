import { describe, expect, it } from "vitest";
import { getFieldResultMeta, sanitizeRangeInput, testTemplateFormSchema } from "./schemas";

describe("test schemas", () => {
  it("accepts range as a valid field type", () => {
    const parsed = testTemplateFormSchema.parse({
      name: "Uroanalisis",
      category: "Uroanalisis",
      base_price: 10,
      schema: {
        sections: [
          {
            id: "section-1",
            name: "General",
            fields: [
              {
                id: "field-1",
                label: "Leucocitos",
                type: "range",
                unit: "p/c",
                reference_ranges: [],
              },
            ],
          },
        ],
      },
    });

    expect(parsed.schema.sections[0].fields[0].type).toBe("range");
  });

  it("sanitizes range input while preserving comparison symbols", () => {
    expect(sanitizeRangeInput(" 0-2 abc <10 / > 5 ")).toBe(" 0-2  <10  > 5 ");
  });

  it("marks semiquantitative interval results as out of range when they exceed the reference window", () => {
    const meta = getFieldResultMeta({
      type: "range",
      value: "2-4",
      reference_ranges: [
        {
          id: "ref-1",
          gender: "ambos",
          age_min: null,
          age_max: null,
          min_value: 0,
          max_value: 1,
          description: "",
        },
      ],
    });

    expect(meta.rangeDisplay).toBe("0 - 1");
    expect(meta.isOutOfRange).toBe(true);
  });

  it("avoids false positives for less-than semiquantitative results within the reference window", () => {
    const meta = getFieldResultMeta({
      type: "range",
      value: "<10",
      reference_ranges: [
        {
          id: "ref-1",
          gender: "ambos",
          age_min: null,
          age_max: null,
          min_value: 0,
          max_value: 15,
          description: "",
        },
      ],
    });

    expect(meta.isOutOfRange).toBe(false);
  });
});
