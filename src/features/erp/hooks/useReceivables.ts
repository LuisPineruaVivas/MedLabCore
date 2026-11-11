import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase as db } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { InstallmentRow, OpenBalanceRow, ReceivablesOverview } from "../types";

// invoices and orders reference each other, so the orders embed must name the FK.
const INVOICE_REF = "id, invoice_number, order_id, balance_due_usd, status, patients(first_name,last_name,id_number,phone), orders!invoices_order_id_fkey(order_seq)";
const OPEN_INVOICE_STATUSES = ["issued", "partial", "overdue"] as const;

/** Installment windows of the receivables screen. "upcoming" = every open one, soonest first. */
export type InstallmentWindow = "overdue" | "week" | "month" | "upcoming";

export function useReceivablesOverview(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.receivablesOverview(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<ReceivablesOverview> => {
      const { data, error } = await db.rpc("get_receivables_overview", { p_org_id: orgId! });
      if (error) throw error;
      return data as unknown as ReceivablesOverview;
    },
  });
}

/** Open installments of every order, by due date. `today`/`monthEnd` are yyyy-MM-dd. */
export function useInstallments(orgId: string | null, window: InstallmentWindow, today: string, weekEnd: string, monthEnd: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.erp.receivablesList(orgId, "installments", { window, today, page, pageSize }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: InstallmentRow[]; total: number }> => {
      let request = db
        .from("payment_schedules")
        .select(`*, invoices!inner(${INVOICE_REF})`, { count: "exact" })
        .eq("org_id", orgId!)
        .in("status", ["pending", "partial", "overdue"])
        .in("invoices.status", [...OPEN_INVOICE_STATUSES]);
      if (window === "overdue") request = request.lt("due_date", today);
      else if (window === "week") request = request.gte("due_date", today).lte("due_date", weekEnd);
      else if (window === "month") request = request.gte("due_date", today).lte("due_date", monthEnd);
      const { data, error, count } = await request
        .order("due_date")
        .order("installment_number")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return { items: (data ?? []) as unknown as InstallmentRow[], total: count ?? 0 };
    },
  });
}

/** Orders that still owe money, oldest first, with their installment plan (if any). */
export function useOpenBalances(orgId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.erp.receivablesList(orgId, "balances", { page, pageSize }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: OpenBalanceRow[]; total: number }> => {
      const { data, error, count } = await db
        .from("invoices")
        .select(`${INVOICE_REF}, issued_at, total_usd, payment_schedules(id,status)`, { count: "exact" })
        .eq("org_id", orgId!)
        .in("status", [...OPEN_INVOICE_STATUSES])
        .gt("balance_due_usd", 0)
        .order("issued_at")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return { items: (data ?? []) as unknown as OpenBalanceRow[], total: count ?? 0 };
    },
  });
}
