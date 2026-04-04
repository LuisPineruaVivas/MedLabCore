import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";

export interface OrganizationFormInput {
  org_name: string;
  country: string;
  state: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  rif: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, city, state, country, address, email, phone, rif, is_active, subscription_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OrganizationFormInput) => {
      const { data, error } = await supabase.functions.invoke("create-organization", {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

export function useToggleOrganizationSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, subscription_active }: { id: string; subscription_active: boolean }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ subscription_active: !subscription_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

export function useToggleOrganizationActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ is_active: !is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

export function getOrganizationMutationError(error: unknown, fallbackMessage: string) {
  return getUserFacingErrorMessage(error, fallbackMessage);
}
