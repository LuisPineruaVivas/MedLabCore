import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExchangeRate(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["exchange-rate", orgId],
    queryFn: async () => {
      // Fetch from API
      const response = await fetch("https://ve.dolarapi.com/v1/dolares");
      if (!response.ok) {
        throw new Error("Failed to fetch exchange rate from API");
      }
      const data = await response.json();

      // Find the official source
      const officialRate = data.find((item: any) => item.fuente === "oficial");
      if (!officialRate) {
        throw new Error("Official exchange rate not found in API response");
      }

      // Return in the expected format
      return {
        rate: officialRate.promedio,
        updated_at: officialRate.fechaActualizacion,
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60, // Consider data stale after 1 hour
    refetchInterval: 1000 * 60 * 60 * 24, // Refetch daily
  });
}
