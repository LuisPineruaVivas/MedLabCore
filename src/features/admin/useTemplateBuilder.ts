import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import type { TestTemplateFormData, TestTemplateRow } from "@/features/tests/schemas";

export function createEmptyTemplateField() {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "number" as const,
    unit: null,
    range: null,
    reference_ranges: [],
  };
}

export function createEmptyTemplateSection() {
  return {
    id: crypto.randomUUID(),
    name: "",
    fields: [createEmptyTemplateField()],
  };
}

export function buildTemplateUpsertPayload(
  formData: TestTemplateFormData,
  options: {
    id?: string;
    orgId?: string | null;
    isFork: boolean;
    isSuperAdmin: boolean;
    existingTemplateOrgId?: string | null;
  }
) {
  const row = {
    name: formData.name,
    category: formData.category,
    base_price: formData.base_price,
    schema: formData.schema as unknown as Json,
    result_type: formData.result_type,
    updated_at: new Date().toISOString(),
  };

  if (options.isFork || !options.id) {
    return {
      mode: "insert" as const,
      values: {
        ...row,
        org_id: options.isSuperAdmin ? null : options.orgId ?? null,
        id_global_ref: options.id,
      },
    };
  }

  return {
    mode: "update" as const,
    values: {
      ...row,
      org_id:
        options.isSuperAdmin && options.existingTemplateOrgId === null
          ? null
          : options.orgId ?? null,
    },
  };
}

export function useTemplateById(id: string | undefined) {
  return useQuery({
    queryKey: ["test-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("id, org_id, name, category, base_price, schema, is_active, created_at, updated_at, id_global_ref, result_type")
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as unknown as TestTemplateRow;
    },
    enabled: !!id,
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      formData,
      id,
      orgId,
      isFork,
      isSuperAdmin,
      existingTemplate,
    }: {
      formData: TestTemplateFormData;
      id?: string;
      orgId?: string | null;
      isFork: boolean;
      isSuperAdmin: boolean;
      existingTemplate?: TestTemplateRow;
    }) => {
      const payload = buildTemplateUpsertPayload(formData, {
        id,
        orgId,
        isFork,
        isSuperAdmin,
        existingTemplateOrgId: existingTemplate?.org_id,
      });

      if (payload.mode === "insert") {
        const { error } = await supabase.from("test_templates").insert([payload.values]);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("test_templates")
        .update(payload.values)
        .eq("id", id!);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.list(variables.orgId, { scope: "admin" }) });
      queryClient.invalidateQueries({ queryKey: ["test-template", variables.id] });
    },
  });
}

