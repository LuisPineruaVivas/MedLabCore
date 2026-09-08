import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { BadgeCheck, Loader2, Stamp, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeleteProfileAsset,
  useProfileSettings,
  useSaveProfileSettings,
} from "./useProfileSettings";

function AssetUploader({
  title,
  description,
  previewUrl,
  hasSavedAsset,
  hasSelectedFile,
  isDeleting = false,
  onFileChange,
  onRemoveSelectedFile,
  onDeleteSavedAsset,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  hasSavedAsset: boolean;
  hasSelectedFile: boolean;
  isDeleting?: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveSelectedFile: () => void;
  onDeleteSavedAsset: () => Promise<void> | void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemoveSelectedFile();
  };

  const handleConfirmDelete = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    await onDeleteSavedAsset();
    setIsConfirmOpen(false);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-40 items-center justify-center rounded-lg border bg-muted/20 p-4">
          {previewUrl ? (
            <img src={previewUrl} alt={title} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <Stamp className="mx-auto mb-2 h-8 w-8" />
              Sin imagen cargada
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />

          {!previewUrl ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir imagen
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Cambiar
              </Button>

              {hasSelectedFile ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-muted-foreground hover:text-foreground"
                  onClick={handleRemoveSelection}
                >
                  <X className="mr-2 h-4 w-4" />
                  Descartar
                </Button>
              ) : hasSavedAsset ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={isDeleting}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Eliminar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-destructive hover:bg-destructive/10"
                  onClick={handleRemoveSelection}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar {title.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará el archivo del almacenamiento de Supabase y de tu perfil. Esta
              acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isDeleting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar {title.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ProfileSettings({ userId }: { userId: string }) {
  const { data, isLoading } = useProfileSettings(userId);
  const saveMutation = useSaveProfileSettings(userId);
  const deleteMutation = useDeleteProfileAsset(userId);

  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [selloFile, setSelloFile] = useState<File | null>(null);
  const [firmaPreviewUrl, setFirmaPreviewUrl] = useState<string | null>(null);
  const [selloPreviewUrl, setSelloPreviewUrl] = useState<string | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<"firma" | "sello" | null>(null);

  useEffect(() => {
    setFirmaPreviewUrl(data?.firma_url ?? null);
    setSelloPreviewUrl(data?.sello_url ?? null);
  }, [data]);

  function handleAssetChange(
    event: ChangeEvent<HTMLInputElement>,
    setFile: Dispatch<SetStateAction<File | null>>,
    setPreview: Dispatch<SetStateAction<string | null>>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleRemoveFirmaSelection() {
    setFirmaFile(null);
    setFirmaPreviewUrl(data?.firma_url ?? null);
  }

  function handleRemoveSelloSelection() {
    setSelloFile(null);
    setSelloPreviewUrl(data?.sello_url ?? null);
  }

  async function handleDeleteSavedFirma() {
    try {
      setDeletingAsset("firma");
      await deleteMutation.mutateAsync({
        assetType: "firma",
        currentUrl: data?.firma_url,
      });
      setFirmaFile(null);
      setFirmaPreviewUrl(null);
    } finally {
      setDeletingAsset(null);
    }
  }

  async function handleDeleteSavedSello() {
    try {
      setDeletingAsset("sello");
      await deleteMutation.mutateAsync({
        assetType: "sello",
        currentUrl: data?.sello_url,
      });
      setSelloFile(null);
      setSelloPreviewUrl(null);
    } finally {
      setDeletingAsset(null);
    }
  }

  async function handleSubmit() {
    await saveMutation.mutateAsync({
      firmaFile,
      selloFile,
      currentFirmaUrl: data?.firma_url,
      currentSelloUrl: data?.sello_url,
    });
    setFirmaFile(null);
    setSelloFile(null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{data?.full_name || "Bioanalista"}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{data?.email || "Sin correo registrado"}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Estas imágenes se usarán para firmar automáticamente el PDF cuando apruebes una orden.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AssetUploader
          title="Firma"
          description="Sube la firma del bioanalista en PNG o JPG."
          previewUrl={firmaPreviewUrl}
          hasSavedAsset={Boolean(data?.firma_url)}
          hasSelectedFile={Boolean(firmaFile)}
          isDeleting={deletingAsset === "firma"}
          onFileChange={(event) => handleAssetChange(event, setFirmaFile, setFirmaPreviewUrl)}
          onRemoveSelectedFile={handleRemoveFirmaSelection}
          onDeleteSavedAsset={handleDeleteSavedFirma}
        />
        <AssetUploader
          title="Sello"
          description="Sube el sello profesional en PNG o JPG."
          previewUrl={selloPreviewUrl}
          hasSavedAsset={Boolean(data?.sello_url)}
          hasSelectedFile={Boolean(selloFile)}
          isDeleting={deletingAsset === "sello"}
          onFileChange={(event) => handleAssetChange(event, setSelloFile, setSelloPreviewUrl)}
          onRemoveSelectedFile={handleRemoveSelloSelection}
          onDeleteSavedAsset={handleDeleteSavedSello}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saveMutation.isPending || (!firmaFile && !selloFile)}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar firma y sello
        </Button>
      </div>
    </div>
  );
}
