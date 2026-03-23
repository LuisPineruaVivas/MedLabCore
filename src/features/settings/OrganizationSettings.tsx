import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Building2, Upload, Loader2 } from "lucide-react";

const orgSchema = z.object({
  name: z.string().min(2, "Nombre del laboratorio es requerido"),
  address: z.string().min(5, "Dirección del laboratorio es requerida"),
  phone: z.string().min(5, "Número de contacto es requerido").nullable().or(z.literal("")),
  logo_url: z.string().nullable().optional(),
  email: z.string().email("Correo Invalido").nullable().or(z.literal("")).optional(),
  primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color inválido"),
  secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color inválido"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export function OrganizationSettings({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Estados para manejar el archivo localmente antes de subirlo
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    async function loadOrgData() {
        try {
        const { data, error } = await supabase
            .from("organizations")
            .select("name, address, phone, logo_url, email, primary_color, secondary_color")
            .eq("id", orgId)
            .single();

        if (error) throw error;
        if (data) {
            // Transformamos nulls en strings vacíos para evitar errores de tipo en los inputs
            form.reset({
            name: data.name || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            logo_url: data.logo_url || "",
            primary_color: data.primary_color || "",
            secondary_color: data.secondary_color || "",
            });
            if (data.logo_url) setPreviewUrl(data.logo_url);
        }
        } catch (error) {
        toast.error("Error cargando la información");
        } finally {
        setFetching(false);
        }
    }
    loadOrgData();
    }, [orgId, form]);

  // Esta función solo cambia la vista previa, no sube nada a Supabase
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    // Crear un URL local para mostrar la imagen inmediatamente
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  async function onSubmit(values: OrgFormValues) {
    setLoading(true);
    let finalLogoUrl = values.logo_url;

    try {
      // 1. Si el usuario seleccionó un archivo nuevo, lo subimos ahora
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${orgId}/logo-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
        finalLogoUrl = publicUrl;
      }

      // 2. Actualizamos la tabla con todos los datos (incluyendo el nuevo URL si existe)
      const { error: dbError } = await supabase
        .from("organizations")
        .update({
          ...values,
          logo_url: finalLogoUrl
        })
        .eq("id", orgId);

      if (dbError) throw dbError;

      toast.success("Informacion actualizada exitosamente");
      setSelectedFile(null);
      form.setValue("logo_url", finalLogoUrl || "");
      
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.log("Errores de validación:", errors))} className="space-y-6">
        <div className="flex items-center gap-4 p-2">
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
                <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
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
                <FormLabel>Dirección del Laboratorio</FormLabel>
                <FormControl><Input {...field} /></FormControl>
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
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Form>
  );
}