import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";

export interface Antibiotic {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function useAntibiotics(options?: { activeOnly?: boolean }) {
  const { organization } = useCurrentOrgContext();
  const orgId = organization?.id;

  return useQuery({
    queryKey: queryKeys.antibiotics.list(orgId, options?.activeOnly),
    queryFn: async () => {
      if (!orgId) throw new Error("No organization selected");

      let query = supabase
        .from("antibiotics")
        .select("*")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (options?.activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Antibiotic[];
    },
    enabled: !!orgId,
  });
}

export function useCreateAntibiotic() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrgContext();
  const orgId = organization?.id;

  return useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error("No organization selected");

      // Primero, obtenemos el max sort_order
      const { data: maxSortData } = await supabase
        .from("antibiotics")
        .select("sort_order")
        .eq("org_id", orgId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const newSortOrder = (maxSortData?.sort_order || 0) + 10;

      const { data, error } = await supabase
        .from("antibiotics")
        .insert({
          org_id: orgId,
          name: name.trim(),
          sort_order: newSortOrder,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Antibiotic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.antibiotics.all(orgId) });
    },
  });
}
