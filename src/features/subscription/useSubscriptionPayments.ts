import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { ReportPaymentPayload, SubscriptionPayment } from "@/types/subscription";

export function useOrgSubscriptionPayments(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["subscription-payments", orgId],
    queryFn: async (): Promise<SubscriptionPayment[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as SubscriptionPayment[]) ?? [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useReportSubscriptionPayment(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReportPaymentPayload) => {
      if (!payload.proof_file) {
        throw new Error("Debe adjuntar una captura o foto del comprobante de pago");
      }

      // 1. Subir comprobante a Supabase Storage
      const fileExt = payload.proof_file.name.split(".").pop() || "png";
      const filePath = `${payload.org_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, payload.proof_file, { upsert: true });

      if (uploadError) {
        throw new Error(`Error al subir comprobante: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);

      // 2. Invocar la función RPC para registrar el pago y activar el período de gracia de 3 días
      const { data, error } = await supabase.rpc("report_subscription_payment", {
        p_org_id: payload.org_id,
        p_amount_usd: payload.amount_usd,
        p_amount_bs: payload.amount_bs ?? null,
        p_exchange_rate: payload.exchange_rate ?? null,
        p_payment_method: payload.payment_method,
        p_reference_number: payload.reference_number,
        p_payment_date: payload.payment_date,
        p_proof_url: publicUrl,
        p_notes: payload.notes ?? null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.organization(orgId) });
        queryClient.invalidateQueries({ queryKey: ["subscription-payments", orgId] });
      }
      queryClient.invalidateQueries({ queryKey: ["superadmin-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
      toast.success("Pago reportado con éxito. Lo revisaremos a la brevedad.");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo registrar el comprobante de pago"));
    },
  });
}
