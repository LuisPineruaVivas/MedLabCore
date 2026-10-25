import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { FinancialSummary, InventorySummary, ProfitabilityReport, ReceivablesReport } from "../types";
import { isValidPeriod, type ReportPeriod } from "../utils/reports";

const REPORT_STALE_TIME = 1000 * 60 * 2;

async function callReport<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useFinancialSummary(orgId: string | null, period: ReportPeriod, enabled = true) {
  return useQuery({
    queryKey: queryKeys.erp.report("financial", orgId, period.from, period.to),
    enabled: enabled && !!orgId && isValidPeriod(period),
    staleTime: REPORT_STALE_TIME,
    queryFn: () => callReport<FinancialSummary>("get_erp_financial_summary", { p_org_id: orgId, p_date_from: period.from, p_date_to: period.to }),
  });
}

export function useProfitabilityReport(orgId: string | null, period: ReportPeriod, enabled = true) {
  return useQuery({
    queryKey: queryKeys.erp.report("profitability", orgId, period.from, period.to),
    enabled: enabled && !!orgId && isValidPeriod(period),
    staleTime: REPORT_STALE_TIME,
    queryFn: () => callReport<ProfitabilityReport>("get_erp_profitability_report", { p_org_id: orgId, p_date_from: period.from, p_date_to: period.to }),
  });
}

export function useInventorySummary(orgId: string | null, period: ReportPeriod, enabled = true) {
  return useQuery({
    queryKey: queryKeys.erp.report("inventory", orgId, period.from, period.to),
    enabled: enabled && !!orgId && isValidPeriod(period),
    staleTime: REPORT_STALE_TIME,
    queryFn: () => callReport<InventorySummary>("get_erp_inventory_summary", { p_org_id: orgId, p_date_from: period.from, p_date_to: period.to }),
  });
}

/** Aging buckets cover every open invoice; the detail list returns the `limit` most overdue. */
export function useReceivablesReport(orgId: string | null, enabled = true, limit = 200) {
  return useQuery({
    queryKey: [...queryKeys.erp.report("receivables", orgId), limit],
    enabled: enabled && !!orgId,
    staleTime: REPORT_STALE_TIME,
    placeholderData: keepPreviousData,
    queryFn: () => callReport<ReceivablesReport>("get_accounts_receivable_report", { p_org_id: orgId, p_limit: limit, p_offset: 0 }),
  });
}
