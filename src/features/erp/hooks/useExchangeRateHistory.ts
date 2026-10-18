import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { ExchangeRateHistory } from "../types";

export function useExchangeRateHistory(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.exchangeRates(orgId), enabled: !!orgId,
    queryFn: async (): Promise<ExchangeRateHistory[]> => {
      const { data, error } = await db.from("exchange_rate_history").select("*").eq("org_id", orgId).order("effective_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveExchangeRate(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ rate, effectiveDate }: { rate: number; effectiveDate: string }) => {
      if (!orgId || rate <= 0) throw new Error("La tasa debe ser mayor a cero.");
      // created_by is stamped by the database from the session (trg_set_exchange_rate_created_by).
      const { error } = await db.from("exchange_rate_history").upsert({ org_id: orgId, rate, effective_date: effectiveDate, source: "manual" }, { onConflict: "org_id,from_currency,to_currency,effective_date" });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.erp.exchangeRates(orgId) }),
  });
}
