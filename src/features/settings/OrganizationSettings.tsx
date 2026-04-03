import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useOrganizationSettings,
  useSaveOrganizationSettings,
} from "./useOrganizationSettings";

const orgSchema = z.object({
  name: z.string().min(2, "Nombre del laboratorio es requerido"),
  address: z.string().min(5, "Direccion del laboratorio es requerida"),
  phone: z.string().min(5, "Numero de contacto es requerido").nullable().or(z.literal("")),
  logo_url: z.string().nullable().optional(),
  email: z.string().email("Correo invalido").nullable().or(z.literal("")).optional(),
  primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color invalido"),
  secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color invalido"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export function OrganizationSettings({ orgId }: { orgId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data, isLoading } = useOrganizationSettings(orgId);
  const saveMutation = useSaveOrganizationSettings(orgId);

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      logo_url: "",
      email: "",
      primary_color: "",
      secondary_color: "",
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    form.reset({
      name: data.name || "",
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      logo_url: data.logo_url || "",
      primary_color: data.primary_color || "",
      secondary_color: data.secondary_color || "",
    });

    setPreviewUrl(data.logo_url || null);
  }, [data, form]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  async function onSubmit(values: OrgFormValues) {
    const payload = {
      name: values.name,
      address: values.address,
      phone: values.phone ?? "",
      logo_url: values.logo_url ?? "",
      email: values.email ?? "",
      primary_color: values.primary_color,
      secondary_color: values.secondary_color,
    };

    const result = await saveMutation.mutateAsync({ values: payload, selectedFile });
    setSelectedFile(null);
    form.setValue("logo_url", result.logo_url || "");
    setPreviewUrl(result.logo_url || null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="md:flex items-center gap-4 p-2">
          <div className="relative w-60 h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-muted-foreground" />
            )}
            <label className="absolute inset-0 cursor-pointer bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload className="w-5 h-5 text-white" />
              <input type="file" className="hidden" onChange={handleLogoChange} accept="image/*" />
            </label>
          </div>
          <div>
            <h4 className="text-sm font-medium">Logo del Laboratorio</h4>
            <p className="text-xs text-muted-foreground">
              {selectedFile ? "Imagen seleccionada (sin guardar)" : "Formatos: PNG, JPG"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Laboratorio</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numero de Contacto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email de Contacto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Direccion del Laboratorio</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Colores de la empresa</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Primario</FormLabel>
                    <div className="flex gap-2 items-center">
                      <FormControl>
                        <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer" />
                      </FormControl>
                      <Input {...field} className="mono text-xs uppercase" placeholder="#000000" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Secundario</FormLabel>
                    <div className="flex gap-2 items-center">
                      <FormControl>
                        <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer" />
                      </FormControl>
                      <Input {...field} className="mono text-xs uppercase" placeholder="#000000" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Form>
  );
}
