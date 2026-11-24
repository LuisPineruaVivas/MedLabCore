// Nueva función/hook simple para el portal público
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

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

type BrandRpc = { maybeSingle: () => Promise<{ data: PublicOrgBrand | null; error: Error | null }> };
// The branding RPCs are not in the generated types until `npm run update-types`.
const publicRpc = supabase as unknown as {
  rpc: {
    (name: "get_public_org_brand", args: { p_org_id: string }): BrandRpc;
    (name: "get_public_org_brand_by_slug", args: { p_slug: string }): BrandRpc;
  };
};

/** Lab branding for the public pages, from `?lab=<slug>` (new links) or `?org=<id>` (older links). */
export function usePublicOrgBrand(orgId: string | null, slug: string | null = null) {
  const ref = slug || orgId;
  return useQuery({
    queryKey: queryKeys.patientPortal.publicOrg(ref),
    queryFn: async () => {
      if (!ref) return null;
      // Anonymous visitors cannot read organizations; the RPC returns only branding columns.
      const { data, error } = await (slug
        ? publicRpc.rpc("get_public_org_brand_by_slug", { p_slug: slug })
        : publicRpc.rpc("get_public_org_brand", { p_org_id: ref })
      ).maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Organización no encontrada");
      return data;
    },
    enabled: !!ref,
  });
}
