import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { Payment } from "../types";

export type PaymentInput = { amount: number; bank_account_id: string; exchange_rate?: number; reference_number?: string };

export function usePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.erp.payments(invoiceId),
    enabled: !!invoiceId,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await db.from("payments").select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidatePayments(orgId: string | null, invoiceId: string | undefined) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: queryKeys.erp.invoice(invoiceId) });
    client.invalidateQueries({ queryKey: ["erp", "invoices", orgId ?? "none"] });
    client.invalidateQueries({ queryKey: queryKeys.erp.payments(invoiceId) });
    client.invalidateQueries({ queryKey: queryKeys.erp.schedules(invoiceId) });
    client.invalidateQueries({ queryKey: queryKeys.erp.receivables(orgId) });
    client.invalidateQueries({ queryKey: ["erp", "cash-summary"] });
  };
}

export function useRegisterPayments(orgId: string | null, invoiceId: string | undefined) {
  const invalidate = useInvalidatePayments(orgId, invoiceId);
  return useMutation({
    mutationFn: async (payments: PaymentInput[]) => {
      if (!orgId || !invoiceId) throw new Error("Factura no disponible.");
      const { data, error } = await db.rpc("register_payment", { p_org_id: orgId, p_invoice_id: invoiceId, p_payments: payments });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useVoidPayment(orgId: string | null, invoiceId: string | undefined) {
  const invalidate = useInvalidatePayments(orgId, invoiceId);
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await db.rpc("void_payment", { p_payment_id: paymentId, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
