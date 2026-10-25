// Nueva función/hook simple para el portal público
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface PublicOrgBrand {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  report_template: string | null;
}

// get_public_org_brand is not in the generated types until `npm run update-types`.
const publicRpc = supabase as unknown as {
  rpc: (name: "get_public_org_brand", args: { p_org_id: string }) => {
    maybeSingle: () => Promise<{ data: PublicOrgBrand | null; error: Error | null }>;
  };
};

export function usePublicOrgBrand(orgId: string | null) {
  return useQuery({
    queryKey: ["public-org", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      // Anonymous visitors cannot read organizations; the RPC returns only branding columns.
      const { data, error } = await publicRpc.rpc("get_public_org_brand", { p_org_id: orgId }).maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Organización no encontrada");
      return data;
    },
    enabled: !!orgId,
  });
}
