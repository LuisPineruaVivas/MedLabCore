import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import type { UserRole } from "@/hooks/useUserRole";

export interface AdminUserFormInput {
  email: string;
  password: string;
  full_name: string;
  org_id: string;
  role: UserRole;
}

export function useAdminOrganizationsList() {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, org_id, created_at, organizations(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AdminUserFormInput) => {
      const response = await supabase.functions.invoke("admin-create-user", {
        body: payload,
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function getAdminUserError(error: unknown, fallbackMessage: string) {
  return getUserFacingErrorMessage(error, fallbackMessage);
}
