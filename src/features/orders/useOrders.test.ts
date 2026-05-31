import { describe, expect, it } from "vitest";
import { buildCreateLabOrderPayload, getOrderStatusInvalidationTargets, getSaveResultsInvalidationTargets } from "./useOrders";

describe("order mutation helpers", () => {
  it("builds the transactional RPC payload for order creation", () => {
    expect(
      buildCreateLabOrderPayload({
        orgId: "org-1",
        patientId: "patient-1",
        createdBy: "user-1",
        notes: "Ayunas",
        exchangeRate: 40,
        totalBs: 600,
        isExempted: true,
        items: [
          {
            template_id: "tpl-1",
            test_name: "Glucosa",
            price: 15,
            schema: { sections: [] },
          },
        ],
      })
    ).toEqual({
      p_org_id: "org-1",
      p_patient_id: "patient-1",
      p_notes: "Ayunas",
      p_exchange_rate: 40,
      p_total_bs: 600,
      p_is_exempted: true,
      p_created_by: "user-1",
      p_items: [
        {
          template_id: "tpl-1",
          test_name: "Glucosa",
          price: 15,
          schema: { sections: [] },
        },
      ],
    });
  });

  it("returns scoped invalidation targets for saved results", () => {
    expect(getSaveResultsInvalidationTargets("order-1", "org-1")).toEqual([
      ["order-items", "order-1", "org-1"],
      ["order", "order-1"],
    ]);
  });

  it("returns all cache targets affected by an order status change", () => {
    expect(getOrderStatusInvalidationTargets("order-1", "org-1")).toEqual([
      ["orders", "org-1"],
      ["orders-stats", "org-1"],
      ["dashboard-recent-orders", "org-1"],
      ["billing-orders", "org-1"],
      ["order", "order-1"],
    ]);
  });
});
