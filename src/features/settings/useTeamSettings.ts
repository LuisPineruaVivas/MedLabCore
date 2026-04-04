import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export interface CreateTeamMemberPayload {
  email: string;
  password: string;
  full_name: string;
  role: string;
}

export function buildCreateTeamMemberPayload(payload: CreateTeamMemberPayload) {
  return {
    email: payload.email,
    password: payload.password,
    full_name: payload.full_name,
    role: payload.role,
  };
}

export function useTeamMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.settings.teamMembers(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useCreateTeamMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTeamMemberPayload) => {
      const response = await supabase.functions.invoke("lab-create-user", {
        body: buildCreateTeamMemberPayload(payload),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.teamMembers(orgId) });
      toast.success("Usuario creado exitosamente");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo crear el usuario"));
    },
  });
}
