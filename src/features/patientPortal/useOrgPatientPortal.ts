// Nueva función/hook simple para el portal público
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function usePublicOrgBrand(orgId: string | null) {
  return useQuery({
    queryKey: ["public-org", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("name, logo_url, primary_color, secondary_color, email, phone, address, report_template")
        .eq("id", orgId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}