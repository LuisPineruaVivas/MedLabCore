import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as db } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { Payable, PayablesSummaryRow } from "../types";

/** "open" = pending or partially paid. */
export type PayableFilter = "open" | "paid" | "cancelled" | "all";

export function usePayables(orgId: string | null, filter: PayableFilter, page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.erp.payables(orgId, { filter, page, pageSize }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: Payable[]; total: number }> => {
      let request = db
        .from("payables")
        .select("id, org_id, category_id, payee, description, reference_number, amount, currency, amount_paid, status, due_date, inventory_transaction_id, cancelled_at, cancel_reason, created_at, finance_categories(name)", { count: "exact" })
        .eq("org_id", orgId!);
      if (filter === "open") request = request.in("status", ["pending", "partial"]);
      else if (filter !== "all") request = request.eq("status", filter);
      // Open bills by due date (soonest first, undated last); history newest first.
      request = filter === "open"
        ? request.order("due_date", { ascending: true, nullsFirst: false }).order("created_at")
        : request.order("created_at", { ascending: false });
      const { data, error, count } = await request.range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return { items: (data ?? []) as Payable[], total: count ?? 0 };
    },
  });
}

export function usePayablesSummary(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.payablesSummary(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<PayablesSummaryRow[]> => {
      const { data, error } = await db.rpc("get_payables_summary", { p_org_id: orgId! });
      if (error) throw error;
      return (data ?? []) as unknown as PayablesSummaryRow[];
    },
  });
}

export interface PayableInput {
  categoryId: string;
  description: string;
  amount: number;
  currency: string;
  dueDate?: string | null;
  payee?: string;
  reference?: string;
}

export interface PayPayableInput {
  payableId: string;
  accountId: string;
  amount: number;
  date: string;
  exchangeRate?: number | null;
  reference?: string;
}

function useInvalidateFinance(orgId: string | null) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.erp.financeAll(orgId) });
}

export function useCreatePayable(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async (input: PayableInput) => {
      if (!orgId) throw new Error("No hay organización seleccionada.");
      const { error } = await db.rpc("create_payable", {
        p_org_id: orgId,
        p_category_id: input.categoryId,
        p_description: input.description,
        p_amount: input.amount,
        p_currency: input.currency,
        p_due_date: input.dueDate || undefined,
        p_payee: input.payee || undefined,
        p_reference_number: input.reference || undefined,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function usePayPayable(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async (input: PayPayableInput) => {
      const { error } = await db.rpc("pay_payable", {
        p_payable_id: input.payableId,
        p_account_id: input.accountId,
        p_amount: input.amount,
        p_movement_date: input.date,
        p_exchange_rate: input.exchangeRate ?? undefined,
        p_reference_number: input.reference || undefined,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCancelPayable(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await db.rpc("cancel_payable", { p_payable_id: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
