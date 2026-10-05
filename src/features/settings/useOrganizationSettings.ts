import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export interface OrganizationSettingsFormValues {
  name: string;
  address: string;
  phone: string | null;
  logo_url?: string | null;
  watermark_url?: string | null;
  email?: string | null;
  primary_color: string;
  secondary_color: string;
  report_footer_text?: string | null;
}

export interface ManualExchangeRatePayload {
  orgId: string;
  rate: number;
  updatedBy?: string | null;
}

export function buildOrganizationLogoPath(orgId: string, fileName: string, timestamp: number) {
  const fileExtension = fileName.split(".").pop() ?? "png";
  return `${orgId}/logo-${timestamp}.${fileExtension}`;
}

export function buildOrganizationWatermarkPath(orgId: string, fileName: string, timestamp: number) {
  const fileExtension = fileName.split(".").pop() ?? "png";
  return `${orgId}/watermark-${timestamp}.${fileExtension}`;
}

export function buildManualExchangeRateUpsert(payload: ManualExchangeRatePayload) {
  return {
    org_id: payload.orgId,
    rate: payload.rate,
    updated_at: new Date().toISOString(),
    updated_by: payload.updatedBy ?? null,
  };
}

export function useOrganizationSettings(orgId: string) {
  return useQuery({
    queryKey: queryKeys.settings.organization(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, address, phone, logo_url, watermark_url, email, primary_color, secondary_color, report_footer_text, report_template")
        .eq("id", orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

export function useSaveOrganizationSettings(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      values,
      selectedFile,
      selectedWatermarkFile,
    }: {
      values: OrganizationSettingsFormValues;
      selectedFile?: File | null;
      selectedWatermarkFile?: File | null;
    }) => {
      let finalLogoUrl = values.logo_url ?? null;
      let finalWatermarkUrl = values.watermark_url ?? null;

      // Upload logo if provided
      if (selectedFile) {
        const filePath = buildOrganizationLogoPath(orgId, selectedFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("logos").getPublicUrl(filePath);
        finalLogoUrl = publicUrl;
      }

      // Upload watermark if provided
      if (selectedWatermarkFile) {
        const filePath = buildOrganizationWatermarkPath(orgId, selectedWatermarkFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(filePath, selectedWatermarkFile, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("logos").getPublicUrl(filePath);
        finalWatermarkUrl = publicUrl;
      }

      const payload = {
        ...values,
        logo_url: finalLogoUrl,
        watermark_url: finalWatermarkUrl,
        report_footer_text: values.report_footer_text ?? null,
      };

      const { error } = await supabase.from("organizations").update(payload).eq("id", orgId);
      if (error) throw error;

      return payload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.organization(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.organization(orgId) });
      toast.success("Informacion actualizada exitosamente");
      return data;
    },

    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar la organizacion"));
    },
  });
}

export function useManualExchangeRate(orgId: string) {
  return useQuery({
    queryKey: queryKeys.settings.manualExchangeRate(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("rate, updated_at")
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

export function useSaveManualExchangeRate(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ManualExchangeRatePayload) => {
      const upsertPayload = buildManualExchangeRateUpsert(payload);
      const { error } = await supabase
        .from("exchange_rates")
        .upsert(upsertPayload, { onConflict: "org_id" });

      if (error) throw error;
      return upsertPayload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.manualExchangeRate(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.exchangeRate(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(orgId, undefined) });
      toast.success("Tasa de cambio actualizada");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar la tasa de cambio"));
    },
  });
}
