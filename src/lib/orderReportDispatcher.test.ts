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
});
