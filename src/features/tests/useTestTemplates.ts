import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { TestTemplateRow } from "./schemas";

type ExamOrderItem = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  sort_order: number | null;
  organization_exam_settings?: Array<{
    custom_sort_order: number | null;
    id: string;
  }> | null;
  custom_sort_order?: number | null;
  settings_id?: string | null;
  resolvedSortOrder?: number;
};

export function buildUpsertExamProfilePayload(
  orgId: string,
  payload: {
    id?: string;
    name: string;
    description: string;
    total_price: number;
    template_ids: string[];
  }
) {
  return {
    p_profile_id: payload.id ?? null,
    p_org_id: orgId,
    p_name: payload.name,
    p_description: payload.description || null,
    p_total_price: payload.total_price,
    p_template_ids: payload.template_ids,
  };
}

export function buildExamOrderUpserts(
  orgId: string,
  items: Array<{ id: string }>,
) {
  return items.map((item, index) => ({
    org_id: orgId,
    template_id: item.id,
    custom_sort_order: index + 1,
  }));
}

function mapExamOrderItems(items: ExamOrderItem[]) {
  return [...items]
    .map((item) => {
      const settings = item.organization_exam_settings?.find(Boolean);
      const resolvedSortOrder = settings?.custom_sort_order ?? item.sort_order ?? 999999;

      return {
        ...item,
        custom_sort_order: settings?.custom_sort_order ?? null,
        settings_id: settings?.id ?? null,
        resolvedSortOrder,
      };
    })
    .sort((left, right) => {
      if (left.resolvedSortOrder === right.resolvedSortOrder) {
        return left.name.localeCompare(right.name);
      }

      return (left.resolvedSortOrder ?? 999999) - (right.resolvedSortOrder ?? 999999);
    });
}

export function useTestTemplates(page: number, search: string) {
  const { orgId } = useCurrentOrgContext();
  const pageSize = 10;

  return useQuery<{ items: TestTemplateRow[]; total: number }>({
    queryKey: queryKeys.testTemplates.list(orgId, { page, search }),
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("v_test_templates_filtered")
        .select("id, org_id, name, category, base_price, schema, is_active, id_global_ref", {
          count: "exact",
        })
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .order("name");

      if (search.trim()) {
        const searchFilter = `%${search.trim()}%`;
        query = query.or(`name.ilike.${searchFilter},category.ilike.${searchFilter}`);
      }

      const { data, error, count } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;

      return {
        items: ((data ?? []) as unknown as TestTemplateRow[]),
        total: count ?? 0,
      };
    },
    enabled: !!orgId,
  });
}

export function useOrderTemplates() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testTemplates.orderTemplates(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_test_templates_filtered")
        .select("id, org_id, name, category, base_price, schema, is_active")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useExamProfiles(enabled = true) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.examProfiles.list(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_profiles")
        .select("id, org_id, name, description, total_price, is_active, created_at, profile_templates_junction(template_id)")
        .eq("org_id", orgId!)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && enabled,
  });
}

export function useOrderProfiles() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.examProfiles.orderProfiles(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_profiles")
        .select("id, name, description, total_price, is_active, profile_templates_junction(template_id, test_templates(id, name, category, base_price, schema))")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useProfileBuilderTemplates(enabled = true) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testTemplates.profileBuilderTemplates(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_test_templates_filtered")
        .select("id, name, category, base_price")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && enabled,
  });
}

export function useTestCategories(enabled = true) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testTemplates.categories(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("category")
        .or(`org_id.is.null,org_id.eq.${orgId}`);

      if (error) throw error;

      const uniqueCategories = Array.from(new Set((data ?? []).map((item) => item.category)));
      return uniqueCategories.filter(Boolean).sort();
    },
    enabled: !!orgId && enabled,
  });
}

export function useExamOrderTemplates(selectedCategory: string, enabled = true) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testTemplates.orderByCategory(orgId, selectedCategory),
    queryFn: async () => {
      if (!orgId || !selectedCategory) {
        return [];
      }

      const { data, error } = await supabase
        .from("v_test_templates_filtered")
        .select(`
          id, name, category, is_active, sort_order,
          organization_exam_settings ( custom_sort_order, id )
        `)
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("category", selectedCategory);

      if (error) throw error;

      return mapExamOrderItems((data ?? []) as ExamOrderItem[]);
    },
    enabled: !!orgId && !!selectedCategory && enabled,
  });
}

export function useTestTemplateStats() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testTemplates.stats(orgId),
    queryFn: async () => {
      const [tests, activeTests, profiles] = await Promise.all([
        supabase
          .from("v_test_templates_filtered")
          .select("id")
          .or(`org_id.is.null,org_id.eq.${orgId}`),
        supabase
          .from("v_test_templates_filtered")
          .select("id")
          .eq("is_active", true)
          .or(`org_id.is.null,org_id.eq.${orgId}`),
        supabase
          .from("exam_profiles")
          .select("id")
          .eq("org_id", orgId!),
      ]);

      if (tests.error) throw tests.error;
      if (activeTests.error) throw activeTests.error;
      if (profiles.error) throw profiles.error;

      return {
        total: tests.data?.length ?? 0,
        active: activeTests.data?.length ?? 0,
        profiles: profiles.data?.length ?? 0,
      };
    },
    enabled: !!orgId,
  });
}

export function useSaveExamProfile() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      description: string;
      total_price: number;
      template_ids: string[];
    }) => {
      const { data, error } = await supabase.rpc("upsert_exam_profile", buildUpsertExamProfilePayload(orgId!, payload));

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.list(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.orderProfiles(orgId) });
    },
  });
}

export function useToggleTestTemplateActive() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("test_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.list(orgId, {}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.stats(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.profileBuilderTemplates(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.orderTemplates(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.categories(orgId) });
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar el examen"));
    },
  });
}

export function useDeleteExamProfile() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from("exam_profiles").delete().eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.list(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.orderProfiles(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.stats(orgId) });
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo eliminar el perfil"));
    },
  });
}

export function useToggleExamProfileActive() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("exam_profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.list(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.examProfiles.orderProfiles(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.stats(orgId) });
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar el perfil"));
    },
  });
}

export function useSaveExamOrder() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async (items: Array<{ id: string }>) => {
      if (!orgId || items.length === 0) {
        return;
      }

      const { error } = await supabase
        .from("organization_exam_settings")
        .upsert(buildExamOrderUpserts(orgId, items), { onConflict: "org_id,template_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.orderTemplates(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.testTemplates.categories(orgId) });
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo guardar el orden de impresion"));
    },
  });
}
