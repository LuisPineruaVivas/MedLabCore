/**
 * Who can move an order forward and who can edit its results, by role and status.
 * - pendiente: secretary, lab_admin and bioanalyst enter results and mark it "por aprobar";
 * - por_aprobar: only the bioanalyst edits results and approves/signs it;
 * - completada / cancelada / procesando: read-only.
 */
export type OrderStatusAction = "mark_ready" | "approve_and_sign";

export function getOrderStatusAction(role: string | null | undefined, status: string): OrderStatusAction | null {
  if (status === "pendiente" && (role === "secretary" || role === "lab_admin" || role === "bioanalyst")) {
    return "mark_ready";
  }
  if (status === "por_aprobar" && role === "bioanalyst") {
    return "approve_and_sign";
  }
  return null;
}

/** Results are editable when the role may act on the order now and has canEnterResults. */
export function canEditOrderResults(role: string | null | undefined, status: string, canEnterResults: boolean): boolean {
  return getOrderStatusAction(role, status) !== null && canEnterResults;
}
