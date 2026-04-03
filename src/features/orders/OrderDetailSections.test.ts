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
});
