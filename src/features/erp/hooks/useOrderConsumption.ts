import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as db } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getOrderStatusInvalidationTargets } from "@/features/orders/useOrders";
import type { BomPreviewLine, ConsumptionInput } from "../types";
import type { Json } from "@/integrations/supabase/types";

export function useOrderBomPreview(orderId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.erp.bomPreview(orderId),
    enabled: enabled && !!orderId,
    staleTime: 0,
    queryFn: async (): Promise<BomPreviewLine[]> => {
      const { data, error } = await db.rpc("get_order_bom_preview", { p_order_id: orderId });
      if (error) throw error;
      return (data ?? []) as unknown as BomPreviewLine[];
    },
  });
}

export interface OrderSignature {
  firma_url: string | null;
  firma_name: string | null;
  sello_url: string | null;
  signature_footer_text: string | null;
}

/** Records the consumption, discounts stock and completes the order in one transaction. */
export function useConfirmOrderConsumption(orgId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (values: { orderId: string; consumptions: ConsumptionInput[]; signature: OrderSignature }) => {
      const { data, error } = await db.rpc("confirm_order_consumption", {
        p_order_id: values.orderId,
        p_consumptions: values.consumptions as unknown as Json,
        p_signature: values.signature as unknown as Json,
      });
      if (error) throw error;
      return data as { lines: number; total_cost: number };
    },
    onSuccess: (_data, values) => {
      getOrderStatusInvalidationTargets(values.orderId, orgId).forEach((queryKey) => client.invalidateQueries({ queryKey }));
      client.invalidateQueries({ queryKey: queryKeys.erp.items(orgId) });
      client.invalidateQueries({ queryKey: queryKeys.erp.kardexAll });
      client.invalidateQueries({ queryKey: queryKeys.erp.bomPreview(values.orderId) });
    },
  });
}
