import { describe, expect, it } from "vitest";
import { generateUnifiedTestReportWord } from "./UnifiedTestReportWord";

describe("generateUnifiedTestReportWord", () => {
  it("creates a DOCX report containing the selected test results", async () => {
    const blob = await generateUnifiedTestReportWord({
      orden: {
        id: "order-1",
        org_id: "org-1",
        patient_id: "patient-1",
        status: "completada",
        payment_status: "paid",
        total_amount: 0,
        is_exempted: false,
        exchange_rate: null,
        firma_url: null,
        firma_name: null,
        total_bs: null,
        notes: null,
        access_pin: null,
        created_at: "2026-10-08T12:00:00.000Z",
        created_by: "user-1",
        updated_at: "2026-10-08T12:00:00.000Z",
        completed_at: null,
        order_seq: 7,
        sello_url: null,
        signature_footer_text: null,
      },
      orderItems: [{
        category: "Hematología",
        test_name: "Hemograma",
        results_data: {
          sections: [{
            name: "Hematología completa",
            fields: [{
              label: "Glóbulos blancos",
              type: "number",
              value: "5.45",
              unit: "10³/µL",
              range: "4.5 - 10.5",
            }],
          }],
        },
      }],
      patientData: {
        name: "Paciente de prueba",
        id: "12345678",
        age: "39 Años",
        gender: "masculino",
      },
      labData: { name: "Laboratorio de prueba" },
    });

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 2))).toEqual([0x50, 0x4b]);
  });
});
