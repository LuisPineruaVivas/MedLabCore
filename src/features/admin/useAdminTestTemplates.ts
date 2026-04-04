import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import type { TestTemplateRow } from "@/features/tests/schemas";

export function useAdminTestTemplates() {
  return useQuery({
    queryKey: queryKeys.testTemplates.list(null, { scope: "admin" }),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("id, org_id, name, category, base_price, schema, is_active, created_at, updated_at, id_global_ref")
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as TestTemplateRow[];
    },
  });
}

export function useToggleAdminTestTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("test_templates")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
    },
  });
}

export function useDeleteAdminTestTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("test_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
    },
  });
}

export function getAdminTemplateError(error: unknown, fallbackMessage: string) {
  return getUserFacingErrorMessage(error, fallbackMessage);
}
