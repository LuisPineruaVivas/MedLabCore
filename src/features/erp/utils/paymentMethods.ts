import type { PaymentMethodType } from "../types";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  zelle: "Zelle",
  pos_terminal: "Punto de venta",
  other: "Otro",
};
