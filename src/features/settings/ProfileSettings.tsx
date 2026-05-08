import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { BadgeCheck, Loader2, Stamp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfileSettings, useSaveProfileSettings } from "./useProfileSettings";

function AssetUploader({
  title,
  description,
  previewUrl,
  onFileChange,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
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
        <label className="block">
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <Button type="button" variant="outline" className="w-full" asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Subir imagen
            </span>
          </Button>
        </label>
      </CardContent>
    </Card>
  );
}

export function ProfileSettings({ userId }: { userId: string }) {
  const { data, isLoading } = useProfileSettings(userId);
  const saveMutation = useSaveProfileSettings(userId);
  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [selloFile, setSelloFile] = useState<File | null>(null);
  const [firmaPreviewUrl, setFirmaPreviewUrl] = useState<string | null>(null);
  const [selloPreviewUrl, setSelloPreviewUrl] = useState<string | null>(null);

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
          onFileChange={(event) => handleAssetChange(event, setFirmaFile, setFirmaPreviewUrl)}
        />
        <AssetUploader
          title="Sello"
          description="Sube el sello profesional en PNG o JPG."
          previewUrl={selloPreviewUrl}
          onFileChange={(event) => handleAssetChange(event, setSelloFile, setSelloPreviewUrl)}
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
