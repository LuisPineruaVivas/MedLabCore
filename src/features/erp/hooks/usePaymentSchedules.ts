import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { PaymentSchedule } from "../types";
export type InstallmentInput = { amount_due_usd: number; due_date: string; notes?: string };
export function usePaymentSchedules(invoiceId: string | undefined) { return useQuery({ queryKey: queryKeys.erp.schedules(invoiceId), enabled: !!invoiceId, queryFn: async (): Promise<PaymentSchedule[]> => { const { data, error } = await db.from("payment_schedules").select("*").eq("invoice_id", invoiceId).order("installment_number"); if (error) throw error; return data ?? []; } }); }
export function useCreatePaymentSchedule(orgId: string | null, invoiceId: string | undefined) { const client = useQueryClient(); return useMutation({ mutationFn: async (installments: InstallmentInput[]) => { if (!orgId || !invoiceId) throw new Error("Factura no disponible."); const { data, error } = await db.rpc("create_payment_schedule", { p_org_id: orgId, p_invoice_id: invoiceId, p_installments: installments }); if (error) throw error; return data; }, onSuccess: () => { client.invalidateQueries({ queryKey: queryKeys.erp.schedules(invoiceId) }); client.invalidateQueries({ queryKey: queryKeys.erp.receivables(orgId) }); } }); }
