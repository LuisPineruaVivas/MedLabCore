import { describe, expect, it } from "vitest";
import { getFieldResultMeta, testTemplateFormSchema } from "./schemas";

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

  it("evaluates comparison expressions and descriptive text against the numeric reference", () => {
    const greaterThanMeta = getFieldResultMeta({
      type: "range",
      value: ">100",
      range: "0-80",
    });
    const moreThanMeta = getFieldResultMeta({
      type: "range",
      value: "Más de 80",
      range: "0-80",
    });
    const lessThanMeta = getFieldResultMeta({
      type: "range",
      value: "<0.5",
      range: "0-1",
    });
    const textOnlyMeta = getFieldResultMeta({
      type: "range",
      value: "No se observa",
      range: "0-80",
    });

    expect(greaterThanMeta.isOutOfRange).toBe(true);
    expect(moreThanMeta.isOutOfRange).toBe(true);
    expect(lessThanMeta.isOutOfRange).toBe(false);
    expect(textOnlyMeta.isOutOfRange).toBe(false);
  });
});
