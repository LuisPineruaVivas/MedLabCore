import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/features/orders/useOrders";
import { startOfMonth, format } from "date-fns";
import { useExchangeRate } from "@/hooks/useExchangeRate";


export function useDashboardStats() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;
  const { data: exchangeRate } = useExchangeRate(profile?.org_id);

  return useQuery({
    queryKey: ["dashboard-stats", orgId],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()-1)).toISOString();
      const lastMonthEnd = startOfMonth(now).toISOString();

      // All queries in parallel
      const [
        patientsRes,
        thisMonthPatientsRes,
        ordersToday,
        lastDayOrders,
        pendingOrders,
        revenueToday,
      ] = await Promise.all([
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", lastMonthEnd),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", todayStart),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", yesterdayStart)
          .lt("created_at", todayStart),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .eq("status", "pendiente"),
        supabase
          .from("orders")
          .select("total_amount")
          .eq("org_id", orgId!)
          .gte("created_at", todayStart),
      ]);

      const totalPatients = patientsRes.count ?? 0;
      const thisMonthPatients = thisMonthPatientsRes.count ?? 0;

      const todayCount = ordersToday.count ?? 0;
      const yesterdayCount = lastDayOrders.count ?? 0;

      const ordersTrend = yesterdayCount > 0
        ? (todayCount - yesterdayCount)
        : 0;

      const pendingCount = pendingOrders.count ?? 0;

      const todayRevenue = (revenueToday.data ?? []).reduce(
        (sum, o) => sum + Number(o.total_amount),
        0
      );



      const revenueInBs = todayRevenue * exchangeRate.rate;

      return {
        totalPatients,
        thisMonthPatients,
        ordersToday: todayCount,
        ordersTrend,
        pendingOrders: pendingCount,
        todayRevenue,
        revenueInBs,
      };
    },
    enabled: !!orgId,
  });
}

export function usePendingOrders() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["dashboard-recent-orders", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, total_amount, created_at, patients(first_name, last_name)"
        )
        .eq("org_id", orgId!)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      // For each order, fetch its items to get test names
      const orderIds = (data ?? []).map((o) => o.id);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, test_name")
        .in("order_id", orderIds);

      const itemsByOrder = (items ?? []).reduce<Record<string, string[]>>(
        (acc, item) => {
          if (!acc[item.order_id]) acc[item.order_id] = [];
          acc[item.order_id].push(item.test_name);
          return acc;
        },
        {}
      );

      return (data ?? []).map((o) => ({
        id: o.id,
        patient: `${(o.patients)?.first_name ?? ""} ${(o.patients)?.last_name ?? ""}`.trim(),
        tests: itemsByOrder[o.id] ?? [],
        status: o.status as "pendiente" | "procesando" | "completada" | "cancelada",
        total: Number(o.total_amount),
        date: format(new Date(o.created_at), "yyyy-MM-dd"),
      }));
    },
    enabled: !!orgId,
  });
}

export function useTopTests() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["dashboard-top-tests", orgId],
    queryFn: async () => {
      // Get all order_items for this org's orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("org_id", orgId!);

      const orderIds = (orders ?? []).map((o) => o.id);
      if (orderIds.length === 0) return [];

      const { data: items } = await supabase
        .from("order_items")
        .select("test_name")
        .in("order_id", orderIds);

      // Count occurrences
      const counts: Record<string, number> = {};
      (items ?? []).forEach((i) => {
        counts[i.test_name] = (counts[i.test_name] ?? 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const max = sorted[0]?.[1] ?? 1;

      return sorted.map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / max) * 100),
      }));
    },
    enabled: !!orgId,
  });
}
