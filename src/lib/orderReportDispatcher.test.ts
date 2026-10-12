import {
  getReportComponent,
  REPORT_TEMPLATES,
  getTestTemplateReportComponent,
  TEST_TEMPLATE_REPORT_TEMPLATES,
} from "./orderReportDispatcher";
import { UnifiedTestReportPDF } from "./unifiedTestReportPDF";
import { UnifiedTestReportRivalta } from "./UnifiedTestReportRivalta";
import { TestReportPDF } from "./testReportGenerator";
import { TestReportRivaltaPDF } from "./testReportRivaltaGenerator";

describe("orderReportDispatcher", () => {
  it("should return default UnifiedTestReportPDF when template key is undefined, null, empty or 'default'", () => {
    expect(getReportComponent()).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent(null)).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent("")).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent("default")).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent("DEFAULT")).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent("  default  ")).toBe(REPORT_TEMPLATES.default);
  });

  it("should return UnifiedTestReportPDF when template key is unknown", () => {
    expect(getReportComponent("non_existent_template")).toBe(REPORT_TEMPLATES.default);
    expect(getReportComponent("random-lab-123")).toBe(REPORT_TEMPLATES.default);
  });

  it("should return UnifiedTestReportRivalta when template key is rivalta (case-insensitive and trimmed)", () => {
    expect(getReportComponent("rivalta")).toBe(REPORT_TEMPLATES.rivalta);
    expect(getReportComponent("Rivalta")).toBe(REPORT_TEMPLATES.rivalta);
    expect(getReportComponent("RIVALTA")).toBe(REPORT_TEMPLATES.rivalta);
    expect(getReportComponent("  rivalta  ")).toBe(REPORT_TEMPLATES.rivalta);
  });

  describe("getTestTemplateReportComponent", () => {
    it("should return default TestReportPDF when template key is undefined, null, empty or 'default'", () => {
      expect(getTestTemplateReportComponent()).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent(null)).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent("")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent("default")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent("DEFAULT")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent("  default  ")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
    });

    it("should return TestReportPDF when template key is unknown", () => {
      expect(getTestTemplateReportComponent("non_existent_template")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
      expect(getTestTemplateReportComponent("random-lab-123")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.default);
    });

    it("should return TestReportRivaltaPDF when template key is rivalta (case-insensitive and trimmed)", () => {
      expect(getTestTemplateReportComponent("rivalta")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.rivalta);
      expect(getTestTemplateReportComponent("Rivalta")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.rivalta);
      expect(getTestTemplateReportComponent("RIVALTA")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.rivalta);
      expect(getTestTemplateReportComponent("  rivalta  ")).toBe(TEST_TEMPLATE_REPORT_TEMPLATES.rivalta);
    });
  });

  describe("Rendering reports with hide_table_header", () => {
    const dummyOrder = {
      id: "order-1",
      org_id: "org-1",
      patient_id: "patient-1",
      order_seq: 1,
      status: "completada" as const,
      payment_status: "paid" as const,
      total_amount: 0,
      total_bs: null,
      is_exempted: false,
      exchange_rate: null,
      access_pin: null,
      firma_url: null,
      firma_name: null,
      sello_url: null,
      signature_footer_text: null,
      notes: null,
      created_at: "2026-10-11T12:00:00.000Z",
      created_by: "user-1",
      updated_at: "2026-10-11T12:00:00.000Z",
      completed_at: null,
    };

    const dummyOrderItems = [
      {
        test_name: "Anca P",
        category: "INMUNOLOGIA",
        resolved_sort_order: 1,
        method_name: "ELISA",
        test_templates: {
          category: "INMUNOLOGIA",
          result_type: "STANDARD",
          schema: JSON.stringify({ hide_table_header: true }),
        },
        results_data: {
          hide_table_header: true,
          sections: [
            {
              name: "",
              fields: [
                {
                  id: "field-1",
                  label: "Anca P",
                  type: "text",
                  value: "ANCA P .......... 0,00\nValores de referencia",
                },
              ],
            },
          ],
        },
      },
    ];

    const dummyPatient = {
      name: "PACIENTE DE PRUEBA",
      id: "14822455",
      age: "30",
      gender: "Masculino",
    };

    const dummyLab = {
      name: "Laboratorio Instumed",
      address: "Calle 14",
      phone: "0271-2587845",
      email: "lab@prueba.com",
    };

    it("renders UnifiedTestReportPDF, UnifiedTestReportPalermo and UnifiedTestReportRivalta without errors", () => {
      const components = [
        REPORT_TEMPLATES.default,
        REPORT_TEMPLATES.palermo,
        REPORT_TEMPLATES.rivalta,
      ];

      for (const ReportComponent of components) {
        expect(() => {
          ReportComponent({
            orden: dummyOrder,
            orderItems: dummyOrderItems,
            patientData: dummyPatient,
            labData: dummyLab,
          });
        }).not.toThrow();
      }
    });
  });
});
