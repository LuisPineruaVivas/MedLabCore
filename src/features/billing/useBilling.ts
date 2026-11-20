import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { matchAllWords } from "@/lib/postgrest";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { parseBillingTotals } from "./billingUtils";

export function useBillingSummary(page: number, search: string, statusFilter: string, monthFilter: string) {
  const { orgId } = useCurrentOrgContext();
  const pageSize = 10;

  return useQuery({
    queryKey: queryKeys.orders.billing(orgId, { page, search, statusFilter, monthFilter }),
    queryFn: async () => {
      if (!orgId) {
        return { orders: [], total: 0, totalRevenue: 0, thisMonthRevenue: 0, pendingCount: 0 };
      }

      const offset = (page - 1) * pageSize;
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      let monthFilterStart: string | null = null;
      let monthFilterEnd: string | null = null;
      if (monthFilter) {
        const [year, month] = monthFilter.split("-").map(Number);
        monthFilterStart = new Date(year, month - 1, 1).toISOString();
        monthFilterEnd = new Date(year, month, 1).toISOString();
      }

      let query = supabase
        .from("orders")
        .select(
          "id, status, total_amount, total_bs, created_at, order_seq, patients!inner(first_name,last_name,id_number), order_items(id)",
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "pendiente" | "por_aprobar" | "procesando" | "completada" | "cancelada");
      }

      if (monthFilterStart && monthFilterEnd) {
        query = query.gte("created_at", monthFilterStart).lt("created_at", monthFilterEnd);
      }

      if (search.trim()) {
        query = query.or(matchAllWords(["first_name", "last_name", "id_number"], search), { foreignTable: "patients" });
      }

      // Totals are summed in the database: PostgREST returns at most 1,000 rows, so
      // summing downloaded orders was silently wrong for larger labs.
      const [{ data: ordersPage, error: pageError, count }, { data: totals, error: totalsError }] = await Promise.all([
        query.range(offset, offset + pageSize - 1),
        supabase.rpc("get_billing_totals", {
          p_org_id: orgId,
          p_from: monthFilterStart ?? undefined,
          p_to: monthFilterEnd ?? undefined,
          p_month_start: monthStart,
        }),
      ]);

      if (pageError) throw pageError;
      if (totalsError) throw totalsError;

      const summary = parseBillingTotals(totals);

      return {
        orders: (ordersPage ?? []).map((order) => ({
          ...order,
          patientName: `${order.patients?.first_name ?? ""} ${order.patients?.last_name ?? ""}`.trim(),
          patientId: order.patients?.id_number,
          tests: (order.order_items ?? []).length,
          created: format(new Date(order.created_at), "yyyy-MM-dd"),
        })),
        total: count ?? 0,
        ...summary,
      };
    },
    enabled: !!orgId,
  });
}
