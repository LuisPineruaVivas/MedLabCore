import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { queryKeys } from "@/lib/queryKeys";

interface DashboardSummaryPayload {
  totalPatients: number;
  thisMonthPatients: number;
  ordersToday: number;
  ordersYesterday: number;
  pendingOrders: number;
  todayRevenue: number;
}

export function useDashboardStats() {
  const { orgId } = useCurrentOrgContext();
  const { data: exchangeRate } = useExchangeRate(orgId);

  return useQuery({
    queryKey: queryKeys.dashboard.stats(orgId, exchangeRate?.updated_at),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_org_id: orgId!,
      });

      if (error) throw error;

      const summary = (data ?? {}) as unknown as DashboardSummaryPayload;
      const todayRevenue = Number(summary.todayRevenue ?? 0);
      const exchangeRateValue = Number(exchangeRate?.rate ?? 0);

      return {
        totalPatients: Number(summary.totalPatients ?? 0),
        thisMonthPatients: Number(summary.thisMonthPatients ?? 0),
        ordersToday: Number(summary.ordersToday ?? 0),
        ordersTrend: Number(summary.ordersToday ?? 0) - Number(summary.ordersYesterday ?? 0),
        pendingOrders: Number(summary.pendingOrders ?? 0),
        todayRevenue,
        revenueInBs: todayRevenue * exchangeRateValue,
      };
    },
    enabled: !!orgId,
  });
}

export function usePendingOrders() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.dashboard.recentOrders(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at, patients(first_name, last_name), order_items(test_name)")
        .eq("org_id", orgId!)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data ?? []).map((order) => ({
        id: order.id,
        patient: `${order.patients?.first_name ?? ""} ${order.patients?.last_name ?? ""}`.trim(),
        tests: (order.order_items ?? []).map((item) => item.test_name),
        status: order.status as "pendiente" | "procesando" | "completada" | "cancelada",
        total: Number(order.total_amount),
        date: format(new Date(order.created_at), "yyyy-MM-dd"),
      }));
    },
    enabled: !!orgId,
  });
}

export function useTopTests() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.dashboard.topTests(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_top_tests", {
        p_org_id: orgId!,
        p_limit: 5,
      });

      if (error) throw error;

      return (data ?? []).map((item) => ({
        name: item.name,
        count: Number(item.count),
        pct: Number(item.pct),
      }));
    },
    enabled: !!orgId,
  });
}
