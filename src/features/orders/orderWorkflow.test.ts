import { canEditOrderResults, getOrderStatusAction } from "./orderWorkflow";

describe("order workflow by role and status", () => {
  it("pending orders: staff mark them ready for approval", () => {
    for (const role of ["secretary", "lab_admin", "bioanalyst"]) {
      expect(getOrderStatusAction(role, "pendiente")).toBe("mark_ready");
      expect(canEditOrderResults(role, "pendiente", true)).toBe(true);
    }
  });

  it("orders awaiting approval: only the bioanalyst edits and approves", () => {
    expect(getOrderStatusAction("bioanalyst", "por_aprobar")).toBe("approve_and_sign");
    expect(canEditOrderResults("bioanalyst", "por_aprobar", true)).toBe(true);
    for (const role of ["secretary", "lab_admin", "lab_affiliate"]) {
      expect(getOrderStatusAction(role, "por_aprobar")).toBeNull();
      expect(canEditOrderResults(role, "por_aprobar", true)).toBe(false);
    }
  });

  it("other statuses and roles are read-only", () => {
    for (const status of ["procesando", "completada", "cancelada"]) {
      expect(getOrderStatusAction("lab_admin", status)).toBeNull();
      expect(canEditOrderResults("bioanalyst", status, true)).toBe(false);
    }
    expect(getOrderStatusAction("lab_affiliate", "pendiente")).toBeNull();
    expect(canEditOrderResults("secretary", "pendiente", false)).toBe(false);
  });
});
