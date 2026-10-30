import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { SubscriptionPayment, SuperAdminMetrics } from "@/types/subscription";

export function useSuperAdminMetrics() {
  return useQuery({
    queryKey: ["superadmin-metrics"],
    queryFn: async (): Promise<SuperAdminMetrics> => {
      const { data, error } = await supabase.rpc("get_superadmin_metrics");
      if (error) throw error;
      return data as unknown as SuperAdminMetrics;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useAdminSubscriptionPayments(statusFilter?: "all" | "pending" | "approved" | "rejected") {
  return useQuery({
    queryKey: ["admin-subscription-payments", statusFilter],
    queryFn: async (): Promise<SubscriptionPayment[]> => {
      let query = supabase
        .from("subscription_payments")
        .select("*, organizations(id, name, rif, email, phone)")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as SubscriptionPayment[]) ?? [];
    },
    staleTime: 1000 * 30, // 30s cache
  });
}

export function useApproveSubscriptionPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.rpc("approve_subscription_payment", {
        p_payment_id: paymentId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      toast.success("Pago aprobado con éxito. Se han añadido 30 días a la suscripción del laboratorio.");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo aprobar el pago"));
    },
  });
}

export function useRejectSubscriptionPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      if (!reason.trim()) {
        throw new Error("Debe indicar el motivo del rechazo");
      }

      const { data, error } = await supabase.rpc("reject_subscription_payment", {
        p_payment_id: paymentId,
        p_rejection_reason: reason.trim(),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      toast.success("Pago rechazado. El laboratorio podrá ver el motivo en su panel.");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo rechazar el pago"));
    },
  });
}
