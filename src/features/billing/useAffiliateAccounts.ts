import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
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

      if (role === "lab_admin" && orgId) {
        query = query.eq("org_id", orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: role === "lab_admin" || role === "super_admin",
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
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("created_by", affiliateId!)
        .eq("payment_status", "pending");

      if (error) throw error;
      return (data ?? []).reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    },
    enabled: !!affiliateId,
  });
}

export function useAffiliateOrders(affiliateId: string | null, paymentStatus: string) {
  return useQuery({
    queryKey: queryKeys.affiliateAccounts.orders(affiliateId, { paymentStatus }),
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_seq, created_at, payment_status, total_amount, patients(first_name, last_name, id_number)"
        )
        .eq("created_by", affiliateId!)
        .order("created_at", { ascending: false });

      if (paymentStatus !== "all") {
        query = query.eq("payment_status", paymentStatus as "pending" | "paid");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AffiliateAccountOrderRow[];
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
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.orders(variables.affiliateId, { paymentStatus: "all" }) });
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.orders(variables.affiliateId, { paymentStatus: "pending" }) });
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.orders(variables.affiliateId, { paymentStatus: "paid" }) });
      queryClient.invalidateQueries({ queryKey: queryKeys.affiliateAccounts.pendingBalance(variables.affiliateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(undefined) });
      toast.success("Ordenes marcadas como pagadas");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar el estado de pago"));
    },
  });
}
