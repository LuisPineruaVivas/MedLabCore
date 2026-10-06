import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Eye, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useOrganizationSettings,
  useSaveOrganizationSettings,
} from "./useOrganizationSettings";
import { DUMMY_ORDER, DUMMY_ORDER_ITEMS, DUMMY_PATIENT, ReportPreviewModal } from "./ReportPreviewModal";
import { DynamicTestReportPDF } from "@/lib/orderReportDispatcher";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { isMobileDevice } from "../orders/orderDetailUtils";

const orgSchema = z.object({
  name: z.string().min(2, "Nombre del laboratorio es requerido"),
  address: z.string().min(5, "Direccion del laboratorio es requerida"),
  phone: z.string().min(5, "Numero de contacto es requerido").nullable().or(z.literal("")),
  logo_url: z.string().nullable().optional(),
  watermark_url: z.string().nullable().optional(),
  email: z.string().email("Correo invalido").nullable().or(z.literal("")).optional(),
  primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color invalido"),
  secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color invalido"),
  report_footer_text: z.string().nullable().optional(),
});

type OrgFormValues = z.infer<typeof orgSchema>;

export function OrganizationSettings({ orgId }: { orgId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedWatermarkFile, setSelectedWatermarkFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkPreviewUrl, setWatermarkPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportTemplate, setReportTemplate] = useState<string>("default");
  const { data, isLoading } = useOrganizationSettings(orgId);
  const saveMutation = useSaveOrganizationSettings(orgId);

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      logo_url: "",
      watermark_url: "",
      email: "",
      primary_color: "#000000",
      secondary_color: "#000000",
      report_footer_text: "",
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
      watermark_url: data.watermark_url || "",
      primary_color: data.primary_color || "#000000",
      secondary_color: data.secondary_color || "#000000",
      report_footer_text: data.report_footer_text || "",
    });

    setPreviewUrl(data.logo_url || null);
    setWatermarkPreviewUrl(data.watermark_url || null);
    setReportTemplate(data.report_template || "default");
  }, [data, form]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleWatermarkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedWatermarkFile(file);
    setWatermarkPreviewUrl(URL.createObjectURL(file));
  };

  async function onSubmit(values: OrgFormValues) {
    const payload = {
      name: values.name,
      address: values.address,
      phone: values.phone ?? "",
      logo_url: values.logo_url ?? "",
      watermark_url: values.watermark_url ?? "",
      email: values.email ?? "",
      primary_color: values.primary_color,
      secondary_color: values.secondary_color,
      report_footer_text: values.report_footer_text ?? null,
    };

    const result = await saveMutation.mutateAsync({ values: payload, selectedFile, selectedWatermarkFile });
    setSelectedFile(null);
    setSelectedWatermarkFile(null);
    form.setValue("logo_url", result.logo_url || "");
    form.setValue("watermark_url", result.watermark_url || "");
    setPreviewUrl(result.logo_url || null);
    setWatermarkPreviewUrl(result.watermark_url || null);
  }

  // Build labData from current form values for live preview
  const currentValues = form.watch();
  const previewLabData = {
    name: currentValues.name || "Laboratorio",
    address: currentValues.address || "",
    phone: currentValues.phone || "",
    email: currentValues.email || "",
    logo: previewUrl,
    watermark: watermarkPreviewUrl,
    primary_color: currentValues.primary_color || "#0ea5e9",
    secondary_color: currentValues.secondary_color || "#0ea5e9",
    report_footer_text: currentValues.report_footer_text || null,
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  async function handlePreviewClick() {
    if (isMobileDevice()) {
      setIsGeneratingPdf(true);
      try {
        const reportBlob = await pdf(
          <DynamicTestReportPDF
            reportTemplate={reportTemplate}
            orden={DUMMY_ORDER}
            orderItems={DUMMY_ORDER_ITEMS}
            departmentOrder={["QUÍMICA SANGUÍNEA", "HEMATOLOGÍA"]}
            patientData={DUMMY_PATIENT}
            labData={previewLabData}
          />
        ).toBlob();

        const url = URL.createObjectURL(reportBlob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error generando reporte móvil:", error);
        toast.error("No se pudo abrir el informe en el móvil. Intenta de nuevo.");
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      setPreviewOpen(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
            <div className="flex flex-col gap-2">
              <div className="relative w-full max-w-[240px] h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
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

            <div className="flex flex-col gap-2">
              <div className="relative w-full max-w-[240px] h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {watermarkPreviewUrl ? (
                  <img src={watermarkPreviewUrl} alt="Watermark Preview" className="w-full h-full object-contain opacity-50" />
                ) : (
                  <div className="text-xs text-muted-foreground text-center p-2">Sin marca de agua</div>
                )}
                <label className="absolute inset-0 cursor-pointer bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="w-5 h-5 text-white" />
                  <input type="file" className="hidden" onChange={handleWatermarkChange} accept="image/*" />
                </label>
              </div>
              <div>
                <h4 className="text-sm font-medium">Marca de agua de fondo</h4>
                <p className="text-xs text-muted-foreground">
                  {selectedWatermarkFile ? "Imagen seleccionada (sin guardar)" : "Opcional. Se mostrará opaca de fondo en el PDF."}
                </p>
              </div>
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

            <div className="space-y-2 pt-4 border-t">
              <FormField
                control={form.control}
                name="report_footer_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pie de página del informe (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Ej: Bioanalista: LCDA. María García  Col. Nº 12345"
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Este texto aparecerá en la parte inferior de cada página del informe PDF. Si lo dejas vacío, no se mostrará ningún pie de página.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewClick}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Previsualizar informe
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Form>

      <ReportPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        labData={previewLabData}
        reportTemplate={reportTemplate}
      />
    </>
  );
}
