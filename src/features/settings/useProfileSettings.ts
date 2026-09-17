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
  signature_footer_text: string | null;
  role: string;
}

export function buildProfileAssetPath(userId: string, assetType: "firma" | "sello", fileName: string, timestamp: number) {
  const extension = fileName.split(".").pop() ?? "png";
  return `${userId}/${assetType}-${timestamp}.${extension}`;
}

export function extractStoragePathFromUrl(url: string, bucketName: string): string | null {
  if (!url) return null;

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    const publicPrefix = `/storage/v1/object/public/${bucketName}/`;
    const publicIndex = parsed.pathname.indexOf(publicPrefix);
    if (publicIndex !== -1) {
      return decodeURIComponent(parsed.pathname.slice(publicIndex + publicPrefix.length));
    }

    const signPrefix = `/storage/v1/object/sign/${bucketName}/`;
    const signIndex = parsed.pathname.indexOf(signPrefix);
    if (signIndex !== -1) {
      return decodeURIComponent(parsed.pathname.slice(signIndex + signPrefix.length));
    }

    const bucketPrefix = `/${bucketName}/`;
    const bucketIndex = parsed.pathname.indexOf(bucketPrefix);
    if (bucketIndex !== -1) {
      return decodeURIComponent(parsed.pathname.slice(bucketIndex + bucketPrefix.length));
    }

    return null;
  } catch {
    return null;
  }
}

export function useProfileSettings(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.settings.profile(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, firma_url, sello_url, role, signature_footer_text")
        .eq("id", userId!)
        .single();

      if (error) throw error;
      return data as ProfileSignatureSettings;
    },
    enabled: !!userId,
  });
}

export function useDeleteProfileAsset(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assetType,
      currentUrl,
    }: {
      assetType: "firma" | "sello";
      currentUrl?: string | null;
    }) => {
      if (currentUrl) {
        const path = extractStoragePathFromUrl(currentUrl, "firms_stamps");
        if (path) {
          const { error: storageError } = await supabase.storage
            .from("firms_stamps")
            .remove([path]);

          if (storageError) {
            console.warn(`[useDeleteProfileAsset] Error eliminando ${path} de storage:`, storageError);
          }
        }
      }

      const field = assetType === "firma" ? "firma_url" : "sello_url";
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ [field]: null })
        .eq("id", userId);

      if (dbError) throw dbError;

      return { assetType };
    },
    onSuccess: ({ assetType }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.profile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      toast.success(
        assetType === "firma"
          ? "Firma eliminada exitosamente"
          : "Sello eliminado exitosamente"
      );
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo eliminar la imagen"));
    },
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
      signatureFooterText,
    }: {
      firmaFile?: File | null;
      selloFile?: File | null;
      currentFirmaUrl?: string | null;
      currentSelloUrl?: string | null;
      signatureFooterText?: string | null;
    }) => {
      let firma_url = currentFirmaUrl ?? null;
      let sello_url = currentSelloUrl ?? null;

      if (firmaFile) {
        if (currentFirmaUrl) {
          const oldPath = extractStoragePathFromUrl(currentFirmaUrl, "firms_stamps");
          if (oldPath) {
            await supabase.storage.from("firms_stamps").remove([oldPath]);
          }
        }

        const firmaPath = buildProfileAssetPath(userId, "firma", firmaFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("firms_stamps")
          .upload(firmaPath, firmaFile, { upsert: true });

        if (uploadError) throw uploadError;

        firma_url = supabase.storage.from("firms_stamps").getPublicUrl(firmaPath).data.publicUrl;
      }

      if (selloFile) {
        if (currentSelloUrl) {
          const oldPath = extractStoragePathFromUrl(currentSelloUrl, "firms_stamps");
          if (oldPath) {
            await supabase.storage.from("firms_stamps").remove([oldPath]);
          }
        }

        const selloPath = buildProfileAssetPath(userId, "sello", selloFile.name, Date.now());
        const { error: uploadError } = await supabase.storage
          .from("firms_stamps")
          .upload(selloPath, selloFile, { upsert: true });

        if (uploadError) throw uploadError;

        sello_url = supabase.storage.from("firms_stamps").getPublicUrl(selloPath).data.publicUrl;
      }

      const payload: { firma_url: string | null; sello_url: string | null; signature_footer_text?: string | null } = {
        firma_url,
        sello_url,
      };

      if (signatureFooterText !== undefined) {
        payload.signature_footer_text = signatureFooterText;
      }

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
