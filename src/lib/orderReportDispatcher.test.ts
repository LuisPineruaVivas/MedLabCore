import { describe, it, expect } from "vitest";
import { getReportComponent, REPORT_TEMPLATES } from "./orderReportDispatcher";
import { UnifiedTestReportPDF } from "./unifiedTestReportPDF";
import { UnifiedTestReportRivalta } from "./UnifiedTestReportRivalta";

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
});
