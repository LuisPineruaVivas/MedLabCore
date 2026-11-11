import { getUserFacingErrorMessage } from "@/lib/errors";

/** Spanish messages for the error codes raised by the ERP RPCs and triggers. */
const ERP_ERROR_MESSAGES: Record<string, string> = {
  ERP_MODULE_DISABLED: "El módulo administrativo no está activo para este laboratorio.",
  ERP_PERMISSION_DENIED: "No tienes permisos para realizar esta operación.",
  ERP_ORG_REQUIRED: "No hay un laboratorio seleccionado.",
  INVALID_MOVEMENT_KIND: "Tipo de movimiento no válido.",
  INVALID_MOVEMENT_AMOUNT: "El monto debe ser mayor que cero.",
  INVALID_CATEGORY: "Selecciona una categoría válida.",
  MOVEMENT_BEFORE_OPENING: "La fecha es anterior a la fecha del saldo inicial de la cuenta.",
  MOVEMENT_IN_FUTURE: "La fecha no puede ser futura.",
  MOVEMENT_NOT_FOUND: "No se encontró el movimiento.",
  MOVEMENT_ALREADY_VOID: "El movimiento ya estaba anulado.",
  ACCOUNT_MOVEMENT_IMMUTABLE: "Los movimientos no se modifican; anúlalo y regístralo de nuevo.",
  TRANSFER_SAME_ACCOUNT: "Elige dos cuentas distintas.",
  TRANSFER_TO_AMOUNT_REQUIRED: "Indica el monto que llega a la cuenta de destino.",
  TRANSFER_AMOUNT_MISMATCH: "Entre cuentas de la misma moneda el monto que sale y el que llega deben ser iguales.",
  TRANSFER_CURRENCY_UNSUPPORTED: "Entre dos monedas distintas, una de las cuentas debe ser en USD.",
  PAYABLE_NOT_FOUND: "No se encontró la cuenta por pagar.",
  PAYABLE_NOT_PAYABLE: "Esta cuenta por pagar ya está pagada o anulada.",
  PAYABLE_ALREADY_PAID: "La cuenta ya está pagada; no se puede anular.",
  PAYABLE_ALREADY_CANCELLED: "La cuenta por pagar ya estaba anulada.",
  PAYABLE_DESCRIPTION_REQUIRED: "Indica qué se debe pagar.",
  INVALID_CURRENCY: "Moneda no válida.",
  INITIAL_STOCK_NOT_PAID: "La carga inicial de inventario no mueve dinero.",
  finance_categories_name_unique: "Ya existe una categoría con ese nombre.",
  PAYMENT_NOT_FOUND: "No se encontró el pago.",
  PAYMENT_ALREADY_VOID: "El pago ya estaba anulado.",
  VOID_REASON_REQUIRED: "Indica el motivo de la anulación.",
  PAYMENT_EXCEEDS_BALANCE: "El monto supera el saldo pendiente de la factura.",
  INVOICE_NOT_PAYABLE: "La factura no admite pagos en su estado actual.",
  EXCHANGE_RATE_REQUIRED: "Falta la tasa de cambio para este pago.",
  EXCHANGE_RATE_OUT_OF_RANGE: "La tasa de cambio es muy inferior a la tasa reciente del laboratorio. Revísala o pide a un administrador que registre el pago.",
  INVALID_BANK_ACCOUNT: "La cuenta seleccionada no está disponible.",
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
