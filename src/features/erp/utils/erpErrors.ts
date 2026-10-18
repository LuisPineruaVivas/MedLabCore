import { getUserFacingErrorMessage } from "@/lib/errors";

/** Spanish messages for the error codes raised by the ERP RPCs and triggers. */
const ERP_ERROR_MESSAGES: Record<string, string> = {
  ERP_MODULE_DISABLED: "El módulo administrativo no está activo para este laboratorio.",
  ERP_PERMISSION_DENIED: "No tienes permisos para realizar esta operación.",
  ERP_ORG_REQUIRED: "No hay un laboratorio seleccionado.",
  CASH_SESSION_ALREADY_OPEN: "Ya hay una caja abierta en este laboratorio.",
  CASH_SESSION_NOT_OPEN: "La caja ya fue cerrada.",
  CASH_SESSION_NOT_FOUND: "No se encontró la sesión de caja.",
  CASH_SESSION_NOT_CLOSED: "Sólo se pueden revisar cajas cerradas.",
  CASH_SESSION_CLOSED: "El pago pertenece a una caja ya cerrada; no se puede anular.",
  INVALID_OPENING_AMOUNT: "El fondo inicial no puede ser negativo.",
  INVALID_ACTUAL_TOTALS: "Revisa los montos contados: deben ser números positivos.",
  PAYMENT_NOT_FOUND: "No se encontró el pago.",
  PAYMENT_ALREADY_VOID: "El pago ya estaba anulado.",
  VOID_REASON_REQUIRED: "Indica el motivo de la anulación.",
  PAYMENT_EXCEEDS_BALANCE: "El monto supera el saldo pendiente de la factura.",
  INVOICE_NOT_PAYABLE: "La factura no admite pagos en su estado actual.",
  EXCHANGE_RATE_REQUIRED: "Falta la tasa de cambio para este pago.",
  INVALID_BANK_ACCOUNT: "El método de cobro seleccionado no está disponible.",
  INSTALLMENTS_MUST_MATCH_BALANCE: "La suma de las cuotas debe ser igual al saldo pendiente.",
  INSUFFICIENT_STOCK: "No hay stock suficiente del insumo.",
  ITEM_NOT_FOUND: "El insumo no existe o está inactivo.",
  ITEM_STOCK_READ_ONLY: "El stock y el costo sólo cambian mediante movimientos de inventario.",
  INITIAL_STOCK_ALREADY_SET: "Este insumo ya tiene movimientos; registra una compra o un ajuste.",
  INVALID_MOVEMENT_QUANTITY: "La cantidad debe ser mayor que cero.",
  INVALID_UNIT_COST: "El costo unitario no puede ser negativo.",
  ADJUSTMENT_REASON_REQUIRED: "Indica el motivo del ajuste.",
  items_code_unique: "Ya existe un insumo con ese código.",
  CONSUMPTION_ALREADY_CONFIRMED: "El consumo de esta orden ya fue confirmado.",
  ORDER_NOT_COMPLETABLE: "La orden ya está completada o cancelada.",
  ORDER_NOT_FOUND: "No se encontró la orden.",
  INVALID_ORDER_ITEM: "Uno de los exámenes no pertenece a esta orden.",
  INVALID_CONSUMPTIONS: "El detalle de consumo no es válido.",
  INVALID_DATE_RANGE: "La fecha inicial debe ser anterior o igual a la final.",
};

export function getErpErrorMessage(error: unknown, fallback = "No se pudo completar la operación.") {
  const raw = getUserFacingErrorMessage(error, fallback);
  const code = Object.keys(ERP_ERROR_MESSAGES).find((key) => raw.includes(key));
  if (!code) return raw;
  // Codes raised as "CODE: detail" (e.g. which supply ran out) keep their detail.
  const detail = raw.split(`${code}:`)[1]?.trim();
  return detail ? `${ERP_ERROR_MESSAGES[code].replace(/\.$/, "")}: ${detail}` : ERP_ERROR_MESSAGES[code];
}
