import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { TestMaterial } from "../types";

export function useTestMaterials(orgId: string | null, templateId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.erp.testMaterials(orgId, templateId),
    enabled: !!orgId && !!templateId,
    queryFn: async (): Promise<TestMaterial[]> => {
      const { data, error } = await db
        .from("test_materials")
        .select("*, items(id, name, code, unit_of_measure, unit_cost, is_active)")
        .eq("org_id", orgId)
        .eq("template_id", templateId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidateRecipe(orgId: string | null, templateId: string | null | undefined) {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: queryKeys.erp.testMaterials(orgId, templateId) });
    client.invalidateQueries({ queryKey: ["erp", "bom-preview"] });
  };
}

/** Adds a supply to the recipe, or updates its quantity if it is already there. */
export function useSaveTestMaterial(orgId: string | null, templateId: string | null | undefined) {
  const invalidate = useInvalidateRecipe(orgId, templateId);
  return useMutation({
    mutationFn: async (values: { item_id: string; quantity_per_test: number; notes?: string | null }) => {
      if (!orgId || !templateId) throw new Error("Examen no disponible.");
      const { error } = await db
        .from("test_materials")
        .upsert(
          { org_id: orgId, template_id: templateId, item_id: values.item_id, quantity_per_test: values.quantity_per_test, notes: values.notes ?? null },
          { onConflict: "org_id,template_id,item_id" }
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTestMaterial(orgId: string | null, templateId: string | null | undefined) {
  const invalidate = useInvalidateRecipe(orgId, templateId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("test_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
