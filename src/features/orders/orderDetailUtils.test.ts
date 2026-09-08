import { describe, expect, it, vi } from "vitest";
import {
  applyOcrResultsToState,
  buildOrderPatientInfo,
  buildThermalReceiptData,
  canApproveAndSignOrder,
  collectOcrFieldLabels,
} from "./orderDetailUtils";

describe("order detail utils", () => {
  it("builds patient info from an order", () => {
    const info = buildOrderPatientInfo({
      id: "order-1",
      order_seq: 1,
      created_at: "2026-03-30T10:00:00.000Z",
      total_amount: 20,
      patients: {
        first_name: "Ana",
        last_name: "Perez",
        id_number: "V123",
        date_of_birth: "1990-03-30",
        gender: "femenino",
      },
    });

    expect(info.name).toBe("ANA PEREZ");
    expect(info.id).toBe("V123");
    expect(info.gender).toBe("femenino");
  });

  it("collects OCR labels only from supported editable fields", () => {
    expect(
      collectOcrFieldLabels(
        [{ id: "item-1", results_data: undefined }],
        {
          "item-1": {
            sections: [
              {
                name: "General",
                fields: [
                  { label: "Glucosa", type: "number" },
                  { label: "Leucocitos", type: "range" },
                  { label: "Comentario", type: "text" },
                  { label: "Estado", type: "select" },
                ],
              },
            ],
          },
        }
      )
    ).toEqual(["Glucosa", "Leucocitos", "Comentario"]);
  });

  it("collects OCR labels only from empty supported editable fields", () => {
    expect(
      collectOcrFieldLabels(
        [{ id: "item-1", results_data: undefined }],
        {
          "item-1": {
            sections: [
              {
                name: "General",
                fields: [
                  { label: "Glucosa", type: "number", value: "95" },
                  { label: "Leucocitos", type: "range", value: "" },
                  { label: "Comentario", type: "text", value: "   " },
                  { label: "Plaquetas", type: "number" },
                ],
              },
            ],
          },
        }
      )
    ).toEqual(["Leucocitos", "Comentario", "Plaquetas"]);
  });

  it("applies OCR results to matching fields and cleans them", () => {
    const updateFieldValue = vi.fn();

    const updated = applyOcrResultsToState(
      [{ id: "item-1", results_data: undefined }],
      {
        "item-1": {
          sections: [
            {
              name: "General",
              fields: [
                { label: "Glucosa", type: "number" },
                { label: "Linfocitos", type: "number" },
                { label: "RangoPrueba", type: "range" },
                { label: "Comentario", type: "text" },
              ],
            },
          ],
        },
      },
      {
        Glucosa: "95.5 mg/dL",
        Linfocitos: "2.9 x 10^3/uL",
        RangoPrueba: "2-4 x 10^3/uL",
        Comentario: "Normal",
      },
      updateFieldValue
    );

    expect(updated).toBe(4);
    expect(updateFieldValue).toHaveBeenNthCalledWith(1, "item-1", 0, 0, "95.5");
    expect(updateFieldValue).toHaveBeenNthCalledWith(2, "item-1", 0, 1, "2.9");
    expect(updateFieldValue).toHaveBeenNthCalledWith(3, "item-1", 0, 2, "2-4");
    expect(updateFieldValue).toHaveBeenNthCalledWith(4, "item-1", 0, 3, "Normal");
  });

  it("builds thermal receipt data from order and priced items", () => {
    const receipt = buildThermalReceiptData(
      {
        id: "order-1",
        order_seq: 12,
        created_at: "2026-03-30T10:00:00.000Z",
        total_amount: 20,
        access_pin: "1234",
        exchange_rate: 40,
        total_bs: 800,
        patients: {
          first_name: "Ana",
          last_name: "Perez",
          id_number: "V123",
          date_of_birth: "1990-03-30",
          gender: "femenino",
        },
      },
      [
        { id: "1", test_name: "Glucosa", price_at_order: 20 },
        { id: "2", test_name: "Comentario", price_at_order: 0 },
      ],
      { name: "ANA PEREZ", id: "V123", age: "36 Años", gender: "femenino" },
      { name: "Lab", primary_color: "#000" },
      "https://app.test"
    );

    expect(receipt.items).toEqual([{ test_name: "Glucosa", price: 20 }]);
    expect(receipt.portalUrl).toBe("https://app.test/portal-paciente");
  });

  describe("canApproveAndSignOrder", () => {
    it("returns false if profile is null or undefined", () => {
      expect(canApproveAndSignOrder(null)).toBe(false);
      expect(canApproveAndSignOrder(undefined)).toBe(false);
    });

    it("returns false if neither firma nor sello is set", () => {
      expect(canApproveAndSignOrder({ firma_url: null, sello_url: null })).toBe(false);
      expect(canApproveAndSignOrder({ firma_url: "", sello_url: "" })).toBe(false);
    });

    it("returns true if only firma is set", () => {
      expect(canApproveAndSignOrder({ firma_url: "https://example.com/firma.png", sello_url: null })).toBe(true);
    });

    it("returns true if only sello is set", () => {
      expect(canApproveAndSignOrder({ firma_url: null, sello_url: "https://example.com/sello.png" })).toBe(true);
    });

    it("returns true if both firma and sello are set", () => {
      expect(
        canApproveAndSignOrder({
          firma_url: "https://example.com/firma.png",
          sello_url: "https://example.com/sello.png",
        })
      ).toBe(true);
    });
  });
});
