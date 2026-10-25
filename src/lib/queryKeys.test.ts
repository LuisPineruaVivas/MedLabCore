import { queryKeys } from "./queryKeys";

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => key[index] === part);

describe("queryKeys", () => {
  it("scopes tenant data by orgId", () => {
    expect(queryKeys.erp.backfillPreview("org-1")).toContain("org-1");
    expect(queryKeys.erp.invoicesAll("org-1")).toContain("org-1");
    expect(queryKeys.auditLogs.orgUsers("org-1")).toContain("org-1");
    expect(queryKeys.antibiotics.list("org-1", true)).toContain("org-1");
    expect(queryKeys.patientPortal.publicOrg("org-1")).toContain("org-1");
  });

  it("keeps prefix keys matching the entries they invalidate", () => {
    expect(startsWith(queryKeys.erp.invoices("org-1", "pending"), queryKeys.erp.invoicesAll("org-1"))).toBe(true);
    expect(startsWith(queryKeys.erp.cashSummary("s-1"), queryKeys.erp.cashSummaryAll)).toBe(true);
    expect(startsWith(queryKeys.erp.kardex("i-1"), queryKeys.erp.kardexAll)).toBe(true);
    expect(startsWith(queryKeys.erp.bomPreview("o-1"), queryKeys.erp.bomPreviewAll)).toBe(true);
    expect(startsWith(queryKeys.erp.report("financial", "org-1"), queryKeys.erp.reportsAll)).toBe(true);
    expect(startsWith(queryKeys.antibiotics.list("org-1"), queryKeys.antibiotics.all("org-1"))).toBe(true);
    expect(startsWith(queryKeys.testTemplates.list("org-1", {}), queryKeys.testTemplates.all)).toBe(true);
    expect(startsWith(queryKeys.patientPortal.orders("p-1", "PIN"), queryKeys.patients.orders("p-1"))).toBe(true);
  });

  it("does not let one org's prefix match another org's entries", () => {
    expect(startsWith(queryKeys.erp.invoices("org-2", "pending"), queryKeys.erp.invoicesAll("org-1"))).toBe(false);
  });
});
