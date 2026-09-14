import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";

export type TestMethod = Tables<"test_methods">;

export type SaveTestMethodInput = {
  id?: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  /** A global method being edited by a lab admin is copied, never changed. */
  forkOfGlobalId?: string | null;
};

/**
 * Returns one effective method per global source: an organization override takes
 * precedence over its factory method, matching the test-template UX.
 */
export function resolveTestMethods(methods: TestMethod[], orgId: string | null | undefined) {
  const ownOverrides = new Set(
    methods.filter((method) => method.org_id === orgId && method.id_global_ref).map((method) => method.id_global_ref),
  );

  return methods
    .filter((method) => method.org_id === orgId || !ownOverrides.has(method.id))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function useTestMethods({ activeOnly = false } = {}) {
  const { orgId, role } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.testMethods.list(orgId, activeOnly),
    queryFn: async () => {
      let query = supabase
        .from("test_methods")
        .select("id, org_id, name, description, is_active, id_global_ref, created_at, updated_at")
        .order("name");

      query = orgId ? query.or(`org_id.is.null,org_id.eq.${orgId}`) : query.is("org_id", null);

      if (activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error) throw error;
      return resolveTestMethods(data ?? [], orgId);
    },
    enabled: !!orgId || role === "super_admin",
  });
}

export function useSaveTestMethod() {
  const { orgId, role } = useCurrentOrgContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveTestMethodInput) => {
      const values = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
      };

      if (input.forkOfGlobalId || !input.id) {
        const { error } = await supabase.from("test_methods").insert({
          ...values,
          org_id: role === "super_admin" ? null : orgId!,
          id_global_ref: input.forkOfGlobalId ?? null,
        });
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("test_methods").update(values).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.testMethods.list(orgId) }),
  });
}

export function useDeleteTestMethod() {
  const { orgId } = useCurrentOrgContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.testMethods.list(orgId) }),
  });
}
