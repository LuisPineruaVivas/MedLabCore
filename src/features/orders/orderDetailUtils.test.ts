import { describe, expect, it, vi } from "vitest";
import { applyOcrResultsToState, buildOrderPatientInfo, buildThermalReceiptData, collectOcrFieldLabels } from "./orderDetailUtils";

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

  it("applies OCR results to matching fields", () => {
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
                { label: "Comentario", type: "text" },
              ],
            },
          ],
        },
      },
      { Glucosa: 95, Comentario: "Normal" },
      updateFieldValue
    );

    expect(updated).toBe(2);
    expect(updateFieldValue).toHaveBeenCalledTimes(2);
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
      { name: "ANA PEREZ", id: "V123" },
      { name: "Lab", primary_color: "#000" },
      "https://app.test"
    );

    expect(receipt.items).toEqual([{ test_name: "Glucosa", price: 20 }]);
    expect(receipt.portalUrl).toBe("https://app.test/portal-paciente");
  });
});
