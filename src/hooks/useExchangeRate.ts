import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExchangeRate(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["exchange-rate", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("rate, updated_at")
        .eq("org_id", orgId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}
