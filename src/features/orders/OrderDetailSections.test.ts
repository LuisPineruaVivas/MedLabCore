import { describe, expect, it } from "vitest";
import { buildLabData, getCategoryStats } from "./OrderDetailSections";

describe("Order detail helpers", () => {
  it("buildLabData returns safe defaults when organization data is missing", () => {
    expect(buildLabData(null)).toEqual({
      name: "Laboratorio",
      address: "",
      phone: "",
      email: "",
      logo: null,
      primary_color: "#0ea5e9",
      secondary_color: "#0ea5e9",
      ciudad: "",
      rif: "",
      lab_admin: "",
      report_footer_text: null,
      watermark: null,
    });
  });

  it("computes category status from entered and modified results", () => {
    const items = [{ id: "item-1", test_name: "Glucosa", price_at_order: 10 }];
    const resultsState = {
      "item-1": {
        sections: [
          {
            name: "General",
            fields: [{ label: "Glucosa", type: "number" as const, value: "96" }],
          },
        ],
      },
    };

    expect(getCategoryStats(items, resultsState, new Set(["item-1"]))).toEqual({
      isCategoryModified: true,
      allResultsEntered: true,
      anyResultsEntered: true,
    });
  });

  it("computes category status as not fully entered when some fields are empty", () => {
    const items = [{ id: "item-1", test_name: "Hematologia", price_at_order: 15 }];
    const resultsState = {
      "item-1": {
        sections: [
          {
            name: "General",
            fields: [
              { label: "Glóbulos Blancos", type: "number" as const, value: "" },
              { label: "Neutrofilo", type: "number" as const, value: "62" },
            ],
          },
        ],
      },
    };

    expect(getCategoryStats(items, resultsState, new Set())).toEqual({
      isCategoryModified: false,
      allResultsEntered: false,
      anyResultsEntered: true,
    });
  });
});
