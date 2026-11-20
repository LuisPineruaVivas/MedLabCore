import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as db } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { AccountBalance, FinanceCategory, FinanceDashboard, FinanceMovementsPage } from "../types";
import type { ReportPeriod } from "../utils/reports";

/** Income, expenses, profit, expenses by category and the last 6 months. Admins only. */
export function useFinanceDashboard(orgId: string | null, period: ReportPeriod, enabled = true) {
  return useQuery({
    queryKey: queryKeys.erp.financeDashboard(orgId, period.from, period.to),
    enabled: !!orgId && enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FinanceDashboard> => {
      const { data, error } = await db.rpc("get_finance_dashboard", { p_org_id: orgId!, p_date_from: period.from, p_date_to: period.to });
      if (error) throw error;
      return data as unknown as FinanceDashboard;
    },
  });
}

export interface MovementFilters {
  from: string | null;
  to: string | null;
  accountId: string | null;
  /** A movement kind, "order_payment", or the groups "transfer" / "adjustment". */
  kind: string | null;
  page: number;
  pageSize: number;
}

/** Balance of every account. Admins only (the RPC refuses other roles). */
export function useAccountBalances(orgId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.erp.accountBalances(orgId),
    enabled: !!orgId && enabled,
    queryFn: async (): Promise<AccountBalance[]> => {
      const { data, error } = await db.rpc("get_account_balances", { p_org_id: orgId! });
      if (error) throw error;
      return (data ?? []) as unknown as AccountBalance[];
    },
  });
}

export function useFinanceMovements(orgId: string | null, filters: MovementFilters) {
  const { page, pageSize, ...rest } = filters;
  return useQuery({
    queryKey: queryKeys.erp.financeMovements(orgId, { ...rest, page, pageSize }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FinanceMovementsPage> => {
      const { data, error } = await db.rpc("get_finance_movements", {
        p_org_id: orgId!,
        p_date_from: rest.from ?? undefined,
        p_date_to: rest.to ?? undefined,
        p_account_id: rest.accountId ?? undefined,
        p_kind: rest.kind ?? undefined,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });
      if (error) throw error;
      return (data ?? { total: 0, rows: [] }) as unknown as FinanceMovementsPage;
    },
  });
}

/** Active categories: the shared defaults plus the lab's own. */
export function useFinanceCategories(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.financeCategories(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<FinanceCategory[]> => {
      const { data, error } = await db
        .from("finance_categories")
        .select("id, org_id, name, kind, is_active, sort_order")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as FinanceCategory[];
    },
  });
}

export function useCreateFinanceCategory(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, kind }: { name: string; kind: "income" | "expense" }) => {
      if (!orgId) throw new Error("No hay organización seleccionada.");
      const { data, error } = await db.from("finance_categories").insert({ org_id: orgId, name: name.trim(), kind }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.erp.financeCategories(orgId) }),
  });
}

export interface MovementInput {
  accountId: string;
  kind: "income" | "expense" | "adjustment_in" | "adjustment_out";
  amount: number;
  categoryId?: string | null;
  description?: string;
  date: string;
  exchangeRate?: number | null;
  reference?: string;
}

export interface TransferInput {
  fromAccountId: string;
  fromAmount: number;
  toAccountId: string;
  toAmount?: number | null;
  date: string;
  description?: string;
  reference?: string;
}

function useInvalidateFinance(orgId: string | null) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.erp.financeAll(orgId) });
}

export function useCreateMovement(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async (input: MovementInput) => {
      if (!orgId) throw new Error("No hay organización seleccionada.");
      const { error } = await db.rpc("create_account_movement", {
        p_org_id: orgId,
        p_account_id: input.accountId,
        p_kind: input.kind,
        p_amount: input.amount,
        p_category_id: input.categoryId ?? undefined,
        p_description: input.description || undefined,
        p_movement_date: input.date,
        p_exchange_rate: input.exchangeRate ?? undefined,
        p_reference_number: input.reference || undefined,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCreateTransfer(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async (input: TransferInput) => {
      if (!orgId) throw new Error("No hay organización seleccionada.");
      const { error } = await db.rpc("create_account_transfer", {
        p_org_id: orgId,
        p_from_account_id: input.fromAccountId,
        p_from_amount: input.fromAmount,
        p_to_account_id: input.toAccountId,
        p_to_amount: input.toAmount ?? undefined,
        p_movement_date: input.date,
        p_description: input.description || undefined,
        p_reference_number: input.reference || undefined,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useVoidMovement(orgId: string | null) {
  const invalidate = useInvalidateFinance(orgId);
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await db.rpc("void_account_movement", { p_movement_id: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
