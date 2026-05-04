import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export interface ProfileSignatureSettings {
  full_name: string | null;
  email: string | null;
  firma_url: string | null;
  sello_url: string | null;
  role: string;
}

export function buildProfileAssetPath(userId: string, assetType: "firma" | "sello", fileName: string, timestamp: number) {
  const extension = fileName.split(".").pop() ?? "png";
  return `${userId}/${assetType}-${timestamp}.${extension}`;
}

export function useProfileSettings(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.settings.profile(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, firma_url, sello_url, role")
        .eq("id", userId!)
        .single();

      if (error) throw error;
      return data as ProfileSignatureSettings;
    },
    enabled: !!userId,
  });
}

export function useSaveProfileSettings(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      firmaFile,
      selloFile,
      currentFirmaUrl,
      currentSelloUrl,
    }: {
      firmaFile?: File | null;
      selloFile?: File | null;
      currentFirmaUrl?: string | null;
      currentSelloUrl?: string | null;
    }) => {
      let firma_url = currentFirmaUrl ?? null;
      let sello_url = currentSelloUrl ?? null;

      if (firmaFile) {
        const firmaPath = buildProfileAssetPath(userId, "firma", firmaFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("firms_stamps")
          .upload(firmaPath, firmaFile, { upsert: true });

        if (uploadError) throw uploadError;

        firma_url = supabase.storage.from("firms_stamps").getPublicUrl(firmaPath).data.publicUrl;
      }

      if (selloFile) {
        const selloPath = buildProfileAssetPath(userId, "sello", selloFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("firms_stamps")
          .upload(selloPath, selloFile, { upsert: true });

        if (uploadError) throw uploadError;

        sello_url = supabase.storage.from("firms_stamps").getPublicUrl(selloPath).data.publicUrl;
      }

      const payload = { firma_url, sello_url };
      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);

      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.profile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      toast.success("Firma y sello actualizados");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar la firma y el sello"));
    },
  });
}
