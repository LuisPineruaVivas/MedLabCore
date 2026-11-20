import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { parseAmount } from "./billingUtils";
import { toast } from "sonner";

export interface AffiliateAccountOrderRow {
  id: string;
  order_seq: number | null;
  created_at: string;
  payment_status: "unpaid" | "partial" | "paid" | "pending";
  total_amount: number;
  patients: {
    first_name: string;
    last_name: string;
    id_number: string;
  } | null;
}

export function useAffiliateUsers() {
  const { orgId, role } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.affiliateAccounts.affiliates(orgId, role),
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, org_id, organizations(name)")
        .eq("role", "lab_affiliate")
        .order("full_name", { ascending: true });

      if (role !== "super_admin" && orgId) {
        query = query.eq("org_id", orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    // OrdersPage also uses this directory to label an order's origin. RLS and
    // the org constraint keep the result scoped to the current laboratory.
    enabled: !!orgId || role === "super_admin",
  });
}

export function useHasAffiliateUsers() {
  const { orgId, role } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.affiliateAccounts.hasAffiliates(orgId, role),
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "lab_affiliate");

      if (role === "lab_admin" && orgId) {
        query = query.eq("org_id", orgId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: role === "lab_admin" || role === "super_admin",
    staleTime: 1000 * 60 * 5,
  });
}

export function useAffiliatePendingBalance(affiliateId: string | null) {
  return useQuery({
    queryKey: queryKeys.affiliateAccounts.pendingBalance(affiliateId),
    queryFn: async () => {
      // Summed in the database: downloading the orders stopped at 1,000 rows.
      const { data, error } = await supabase.rpc("get_affiliate_pending_balance", { p_affiliate_id: affiliateId! });
      if (error) throw error;
      return parseAmount(data);
    },
    enabled: !!affiliateId,
  });
}

export const AFFILIATE_ORDERS_PAGE_SIZE = 50;

export function useAffiliateOrders(affiliateId: string | null, paymentStatus: string, page: number) {
  return useQuery({
    queryKey: queryKeys.affiliateAccounts.orders(affiliateId, { paymentStatus, page }),
    queryFn: async () => {
      const offset = (page - 1) * AFFILIATE_ORDERS_PAGE_SIZE;
      let query = supabase
        .from("orders")
        .select(
          "id, order_seq, created_at, payment_status, total_amount, patients(first_name, last_name, id_number)",
          { count: "exact" }
        )
        .eq("created_by", affiliateId!)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (paymentStatus !== "all") {
        query = query.eq("payment_status", paymentStatus as "pending" | "paid");
      }

      const { data, error, count } = await query.range(offset, offset + AFFILIATE_ORDERS_PAGE_SIZE - 1);
      // PGRST103 (HTTP 416): the page is past the end, e.g. after its orders were marked
      // paid. Report it as empty; the page then moves back to a page that exists.
      if (error?.code === "PGRST103") return { orders: [] as AffiliateAccountOrderRow[], total: 0 };
      if (error) throw error;
      return { orders: (data ?? []) as AffiliateAccountOrderRow[], total: count ?? 0 };
    },
    enabled: !!affiliateId,
  });
}

export function useMarkAffiliateOrdersPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      affiliateId,
      orderIds,
    }: {
      affiliateId: string;
      orderIds: string[];
    }) => {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("created_by", affiliateId)
        .in("id", orderIds);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.ordersAll(variables.affiliateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.pendingBalance(variables.affiliateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(undefined) });
      toast.success("Ordenes marcadas como pagadas");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar el estado de pago"));
    },
  });
}
