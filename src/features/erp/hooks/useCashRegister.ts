import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { CashSession, CashSessionTotals } from "../types";

export function useOpenCashSession(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.cashSession(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<CashSession | null> => {
      const { data, error } = await db.from("cash_register_sessions").select("*").eq("org_id", orgId).eq("status", "open").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCashSessions(orgId: string | null, limit = 30) {
  return useQuery({
    queryKey: [...queryKeys.erp.cashSessions(orgId), limit],
    placeholderData: keepPreviousData,
    enabled: !!orgId,
    queryFn: async (): Promise<CashSession[]> => {
      const { data, error } = await db
        .from("cash_register_sessions")
        .select("*")
        .eq("org_id", orgId)
        .neq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Live expected totals of an open session (recomputed from its payments). */
export function useCashSessionSummary(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.erp.cashSummary(sessionId),
    enabled: !!sessionId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CashSessionTotals> => {
      const { data, error } = await db.rpc("get_cash_session_summary", { p_session_id: sessionId });
      if (error) throw error;
      return data ?? {};
    },
  });
}

function useRefreshCash(orgId: string | null) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: queryKeys.erp.cashSession(orgId) });
    client.invalidateQueries({ queryKey: queryKeys.erp.cashSessions(orgId) });
    client.invalidateQueries({ queryKey: queryKeys.erp.cashSummaryAll });
  };
}

export function useOpenCash(orgId: string | null) {
  const refresh = useRefreshCash(orgId);
  return useMutation({
    mutationFn: async (values: { usd: number; ves: number; notes: string }) => {
      const { error } = await db.rpc("open_cash_session", {
        p_org_id: orgId,
        p_opening_usd: values.usd,
        p_opening_ves: values.ves,
        p_notes: values.notes,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useCloseCash(orgId: string | null) {
  const refresh = useRefreshCash(orgId);
  return useMutation({
    mutationFn: async (values: { sessionId: string; counted: Record<string, number>; notes: string }) => {
      const { error } = await db.rpc("close_cash_session", {
        p_session_id: values.sessionId,
        p_actual_totals: values.counted,
        p_closing_notes: values.notes,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useReviewCash(orgId: string | null) {
  const refresh = useRefreshCash(orgId);
  return useMutation({
    mutationFn: async (values: { sessionId: string; notes?: string }) => {
      const { error } = await db.rpc("review_cash_session", { p_session_id: values.sessionId, p_notes: values.notes ?? null });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
