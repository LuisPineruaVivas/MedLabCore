import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  GripVertical,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  ListPlus,
  ArrowLeft,
  Eye,
  Save,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  testTemplateFormSchema,
  TestTemplateFormData,
  TemplateSection,
  TemplateField,
  TEMPLATE_CATEGORIES,
  ReferenceRange,
} from "@/features/tests/schemas";
import { ReferenceRangesEditor } from "@/features/tests/ReferenceRangesEditor";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PDFViewer } from "@react-pdf/renderer";
import { getTestTemplateReportComponent } from "@/lib/orderReportDispatcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { createEmptyTemplateField, createEmptyTemplateSection, useSaveTemplate, useTemplateById } from "@/features/admin/useTemplateBuilder";
import { type MicrobiologyFieldDef, getMicrobiologyFields } from "@/features/microbiology/types";

// ── Helpers ──────────────────────────────────────────────────────
function emptyField(): TemplateField {
  return createEmptyTemplateField();
}

function emptySection(): TemplateSection {
  return createEmptyTemplateSection();
}

// ── Main Page ────────────────────────────────────────────────────
export default function TemplateBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isFork = searchParams.get("fork") === "1";
  const { orgId, organization } = useCurrentOrgContext();
  const { isSuperAdmin } = useUserRole();
  const PreviewReport = getTestTemplateReportComponent(organization?.report_template);

  // ── Fetch existing template if editing ──────────────────────
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useTemplateById(id);

  // ── Derive initial form data ────────────────────────────────
  const initialData: TestTemplateFormData | undefined = existingTemplate
    ? {
        id: isFork ? undefined : existingTemplate.id,
        name: existingTemplate.name,
        category: existingTemplate.category,
        base_price: Number(existingTemplate.base_price),
        schema: existingTemplate.schema,
        result_type: existingTemplate.result_type || "STANDARD",
      }
    : undefined;

  const defaultValues: TestTemplateFormData = {
    name: "",
    category: "",
    base_price: 0,
    schema: { sections: [emptySection()] },
    result_type: "STANDARD",
  };

  // ── Form ────────────────────────────────────────────────────
  const form = useForm<TestTemplateFormData>({
    resolver: zodResolver(testTemplateFormSchema),
    defaultValues,
    values: initialData ?? undefined,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const sections = watch("schema.sections");
  const currentFormData = watch();

  // ── Section CRUD ────────────────────────────────────────────
  function addSection() {
    setValue("schema.sections", [...sections, emptySection()]);
  }

  function removeSection(idx: number) {
    setValue(
      "schema.sections",
      sections.filter((_, i) => i !== idx)
    );
  }

  function updateSectionName(idx: number, name: string) {
    const next = [...sections];
    next[idx] = { ...next[idx], name };
    setValue("schema.sections", next);
  }

  // ── Field CRUD ──────────────────────────────────────────────
  function addField(sIdx: number) {
    const next = [...sections];
    next[sIdx] = { ...next[sIdx], fields: [...next[sIdx].fields, emptyField()] };
    setValue("schema.sections", next);
  }

  function removeField(sIdx: number, fIdx: number) {
    const next = [...sections];
    next[sIdx] = {
      ...next[sIdx],
      fields: next[sIdx].fields.filter((_, i) => i !== fIdx),
    };
    setValue("schema.sections", next);
  }

  function updateField(sIdx: number, fIdx: number, patch: Partial<TemplateField>) {
    const next = [...sections];
    next[sIdx] = {
      ...next[sIdx],
      fields: next[sIdx].fields.map((f, i) => (i === fIdx ? { ...f, ...patch } : f)),
    };
    setValue("schema.sections", next);
  }

  function moveFieldUp(sIdx: number, fIdx: number) {
    if (fIdx === 0) return;
    const next = [...sections];
    const fields = [...next[sIdx].fields];
    // Swap
    [fields[fIdx - 1], fields[fIdx]] = [fields[fIdx], fields[fIdx - 1]];
    next[sIdx] = { ...next[sIdx], fields };
    setValue("schema.sections", next);
  }

  function moveFieldDown(sIdx: number, fIdx: number) {
    const next = [...sections];
    const fields = [...next[sIdx].fields];
    if (fIdx === fields.length - 1) return;
    // Swap
    [fields[fIdx + 1], fields[fIdx]] = [fields[fIdx], fields[fIdx + 1]];
    next[sIdx] = { ...next[sIdx], fields };
    setValue("schema.sections", next);
  }

  function insertFieldAfter(sIdx: number, fIdx: number) {
    const next = [...sections];
    const fields = [...next[sIdx].fields];
    fields.splice(fIdx + 1, 0, emptyField());
    next[sIdx] = { ...next[sIdx], fields };
    setValue("schema.sections", next);
  }

  // ── Collapsed state ──────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Microbiology fields state ─────────────────────────────────
  const getInitialMicroFields = (): MicrobiologyFieldDef[] => {
    const schema = existingTemplate?.schema as { microbiology_fields?: MicrobiologyFieldDef[] } | null | undefined;
    return getMicrobiologyFields(schema).map((field) => ({ ...field }));
  };
  const [microbiologyFields, setMicrobiologyFields] = useState<MicrobiologyFieldDef[]>(getInitialMicroFields);
  const specimenFields = microbiologyFields.filter(
    (field) => field.key === "sample_type" || field.key === "gram_stain"
  );
  const additionalMicroFields = microbiologyFields.filter((field) => !field.fixed);
  const cultureResultField = microbiologyFields.find((field) => field.key === "culture_result");

  // Sync microbiologyFields when existingTemplate finishes loading asynchronously
  useEffect(() => {
    if (existingTemplate?.schema) {
      const rawSchema = typeof existingTemplate.schema === "string"
        ? JSON.parse(existingTemplate.schema)
        : existingTemplate.schema;
      if (rawSchema?.microbiology_fields && Array.isArray(rawSchema.microbiology_fields) && rawSchema.microbiology_fields.length > 0) {
        setMicrobiologyFields(getMicrobiologyFields(rawSchema));
      }
    }
  }, [existingTemplate]);

  function addMicroField() {
    const id = `custom-${Date.now()}`;
    setMicrobiologyFields(prev => [
      ...prev,
      { id, key: id, label: "", fixed: false },
    ]);
  }

  function removeMicroField(id: string) {
    setMicrobiologyFields(prev => prev.filter(f => f.id !== id));
  }

  function updateMicroFieldLabel(id: string, label: string) {
    setMicrobiologyFields(prev => prev.map(f => f.id === id ? { ...f, label } : f));
  }

  // ── Save mutation ────────────────────────────────────────────
  const saveMutation = useSaveTemplate();

  const pageTitle = isFork
    ? "Personalizar Plantilla"
    : id
    ? "Editar Plantilla"
    : "Nueva Plantilla de Examen";

  if (isLoadingTemplate) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando…
      </div>
    );
  }

  function getLabData(organization: ReturnType<typeof useCurrentOrgContext>["organization"]) {
    return {
      name: organization?.name || "Nombre del Laboratorio",
      address: organization?.address || "Dirección desde Perfil",
      phone: organization?.phone || "Teléfono desde Perfil",
      email: organization?.email || "Correo desde Perfil",
      logo: organization?.logo_url || null,
      primary_color: organization?.primary_color || "#0ea5e9",
      secondary_color: organization?.secondary_color || "#4f46e5",
    };
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Header + Save Bar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <FlaskConical className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate">{pageTitle}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Define las secciones y campos del examen
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 hidden sm:inline-flex"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {previewLoading ? "Generando..." : "Vista Previa"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-blue-600 sm:hidden"
              onClick={() => setShowPreview(true)}
            >
              {previewLoading ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>

            <Button
              form="template-builder-form"
              type="submit"
              disabled={saveMutation.isPending}
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Guardando…" : "Guardar Plantilla"}
            </Button>
            <Button
              form="template-builder-form"
              type="submit"
              size="icon"
              className="sm:hidden"
              disabled={saveMutation.isPending}
            >
              <Save className="w-4 h-4" />              
            </Button>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <form
          id="template-builder-form"
          onSubmit={handleSubmit(
            (data) => {
              const formattedData: TestTemplateFormData =
                data.result_type === "MICROBIOLOGY"
                  ? {
                      ...data,
                      schema: {
                        sections: [],
                        // Store customized field definitions so the form and report
                        // can use the lab's preferred labels and extra fields.
                        microbiology_fields: microbiologyFields,
                      },
                    }
                  : data;

              return saveMutation.mutate(
                {
                  formData: formattedData,
                  id,
                  orgId,
                  isFork,
                  isSuperAdmin,
                  existingTemplate,
                },
                {
                  onSuccess: () => {
                    toast.success(isFork || !id ? "Plantilla creada" : "Plantilla actualizada");
                    navigate(-1);
                  },
                  onError: (error) => {
                    toast.error(getUserFacingErrorMessage(error, "No se pudo guardar la plantilla"));
                  },
                }
              );
            },
            (validationErrors) => {
              console.log("❌ Zod Errors Detail:", validationErrors);
            }
          )}
          className="space-y-6"
        >
          {/* ── Validation errors ── */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm font-bold text-red-600 mb-2">
                El formulario tiene campos inválidos:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(errors).map(([key, value]) => (
                  <li key={key} className="text-xs text-red-500 font-medium">
                    <span className="uppercase">{key}</span>:{" "}
                    {typeof value.message === "string"
                      ? value.message
                      : "Revisa este campo"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Meta fields ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name">Nombre del Examen</Label>
                  <Input
                    id="tpl-name"
                    placeholder="e.g. Hemograma Completo"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-category">Departamento</Label>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="tpl-category">
                          <SelectValue placeholder="Selecciona un departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.category && (
                    <p className="text-xs text-destructive">
                      {errors.category.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-price">Precio del Examen</Label>
                  <Input
                    id="tpl-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="25.00"
                    {...register("base_price")}
                  />
                  {errors.base_price && (
                    <p className="text-xs text-destructive">
                      {errors.base_price.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center space-x-2 h-10">
                    <Controller
                      control={control}
                      name="schema.hide_table_header"
                      render={({ field }) => (
                        <Switch
                          id="tpl-hide-header"
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="tpl-hide-header" className="cursor-pointer">Ocultar Encabezado de Tabla</Label>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-3 pt-2 border-t border-border/60">
                  <Label htmlFor="tpl-result-type" className="font-semibold text-foreground">
                    Tipo / Estructura del Examen
                  </Label>
                  <Controller
                    control={control}
                    name="result_type"
                    render={({ field }) => (
                      <Select
                        value={field.value || "STANDARD"}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="tpl-result-type" className="w-full sm:w-80">
                          <SelectValue placeholder="Selecciona la estructura" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">
                            Estándar / Cuantitativo (Campos y rangos personalizables)
                          </SelectItem>
                          <SelectItem value="MICROBIOLOGY">
                            Microbiología / Cultivo (Muestra, Gram y Antibiograma dinámico)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecciona "Microbiología" para exámenes de cultivos bacteriológicos que requieren antibiogramas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Sections or Microbiology Fields Editor ── */}
          {currentFormData.result_type === "MICROBIOLOGY" ? (
            <div className="space-y-4">
              {/* The first two fixed fields describe the specimen and direct examination. */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    Muestra y examen directo
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Personaliza las etiquetas de los dos campos fijos que aparecen al inicio del informe.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {specimenFields.map((mField) => (
                    <div
                      key={mField.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Campo fijo — puedes renombrar la etiqueta
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder={`Ej. ${mField.key === "sample_type" ? "Tipo de Muestra" : "Coloración de Gram"}`}
                          value={mField.label}
                          onChange={(e) => updateMicroFieldLabel(mField.id, e.target.value)}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                        Fijo
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Campos adicionales
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMicroField}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Agregar Campo Extra
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estos campos de texto libre aparecen después de los datos de muestra y antes del resultado del cultivo/antibiograma.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {additionalMicroFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay campos adicionales. Puedes agregarlos si necesitas incluir observaciones u otra información.
                    </p>
                  ) : (
                    additionalMicroFields.map((mField) => (
                      <div
                        key={mField.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                      >
                        <div className="w-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Campo personalizado (texto libre)
                          </Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Ej. Observaciones, Notas..."
                            value={mField.label}
                            onChange={(e) => updateMicroFieldLabel(mField.id, e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeMicroField(mField.id)}
                          title="Eliminar campo"
                          aria-label={`Eliminar campo ${mField.label || "personalizado"}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* The culture label belongs to the dedicated culture/antibiogram section in result entry and reports. */}
              <Card className="border-primary/30 bg-primary/[0.03]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    Resultado del cultivo y antibiograma
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Campo fijo · aparece al final
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Esta etiqueta identifica la sección que va después de los campos adicionales. En el resultado se usa para escribir el texto del cultivo negativo o presentar los gérmenes aislados y su antibiograma.
                  </p>
                </CardHeader>
                <CardContent>
                  {cultureResultField && (
                    <div key={cultureResultField.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Etiqueta de la sección (solo puedes renombrarla)
                        </Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="Ej. Resultado del Cultivo"
                          value={cultureResultField.label}
                          onChange={(e) => updateMicroFieldLabel(cultureResultField.id, e.target.value)}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                        Fijo
                      </span>
                    </div>
                  )}
                  <ul className="list-disc pl-5 mt-3 text-xs text-muted-foreground space-y-1">
                    <li>El bioanalista elige entre texto libre (cultivo negativo/descriptivo) o gérmenes aislados.</li>
                    <li>La tabla interactiva de sensibilidad (S / I / R) se habilita al registrar gérmenes, hasta un máximo de 3.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Secciones y Campos</h2>
                <Button type="button" variant="outline" size="sm" onClick={addSection}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Sección
                </Button>
              </div>

              {typeof errors.schema === "object" && errors.schema && "sections" in errors.schema && errors.schema.sections && (
                <p className="text-xs text-destructive">
                  {typeof errors.schema.sections.message === "string"
                    ? errors.schema.sections.message
                    : "Revisa las secciones"}
                </p>
              )}

              {sections.map((section, sIdx) => (
                <Collapsible
                  key={section.id}
                  open={!collapsed[sIdx]}
                  onOpenChange={(val) =>
                    setCollapsed((p) => ({ ...p, [sIdx]: !val }))
                  }
                >
                  <Card className="overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                      <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {collapsed[sIdx] ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Input
                        className="h-8 text-sm font-medium flex-1 bg-transparent border-none focus-visible:ring-1"
                        placeholder="Nombre de la sección (e.g. Análisis Físico)"
                        value={section.name}
                        onChange={(e) => updateSectionName(sIdx, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {section.fields.length} campo
                        {section.fields.length !== 1 ? "s" : ""}
                      </span>
                      {sections.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeSection(sIdx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Fields */}
                    <CollapsibleContent>
                      <CardContent className="p-3 space-y-3">
                        {section.fields.map((field, fIdx) => (
                          <FieldRow
                            key={field.id}
                            field={field}
                            onUpdate={(patch) => updateField(sIdx, fIdx, patch)}
                            onRemove={
                              section.fields.length > 1
                                ? () => removeField(sIdx, fIdx)
                                : undefined
                            }
                            onMoveUp={fIdx > 0 ? () => moveFieldUp(sIdx, fIdx) : undefined}
                            onMoveDown={fIdx < section.fields.length - 1 ? () => moveFieldDown(sIdx, fIdx) : undefined}
                            onInsertAfter={() => insertFieldAfter(sIdx, fIdx)}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs mt-1"
                          onClick={() => addField(sIdx)}
                        >
                          <ListPlus className="w-3.5 h-3.5 mr-1" /> Agregar Campo
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {/* Bottom add section shortcut */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed text-muted-foreground hover:text-foreground"
                onClick={addSection}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Sección
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* ── PDF Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogHeader>
          <DialogTitle className="sr-only">Vista Previa del Examen</DialogTitle>
          <DialogDescription className="sr-only">Revisa como se vera el informe antes de guardarlo</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden border-none">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-medium text-sm">
                  Vista Previa: {currentFormData.name || "Nuevo Examen"}
                </h3>
                {currentFormData.result_type === "MICROBIOLOGY" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Datos ficticios de ejemplo para mostrar el informe bacteriológico.
                  </p>
                )}
              </div>
            </div>
            <div className="flex-1 bg-white">
              <PDFViewer width="100%" height="100%" showToolbar={true}>
                <PreviewReport
                  template={{
                    id: existingTemplate?.id || "preview",
                    name: currentFormData.name,
                    category: currentFormData.category,
                    base_price: currentFormData.base_price,
                    schema: currentFormData.result_type === "MICROBIOLOGY"
                      ? { sections: [], microbiology_fields: microbiologyFields }
                      : currentFormData.schema,
                    is_active: true,
                    org_id: null,
                    created_at: "",
                    updated_at: "",
                    result_type: currentFormData.result_type,
                  }}
                  labData={getLabData(organization)}
                />
              </PDFViewer>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Field Row ────────────────────────────────────────────────────
function FieldRow({
  field,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
}: {
  field: TemplateField;
  onUpdate: (patch: Partial<TemplateField>) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onInsertAfter: () => void;
}) {

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        {/* Label */}
        <div className="sm:col-span-2">
          <Label className="text-xs">Nombre del Campo</Label>
          <Input
            className="h-8 text-xs mt-1"
            placeholder="e.g. Hemoglobina"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>

        {/* Type */}
        <div className="sm:col-span-1">
          <Label className="text-xs">Tipo de Dato</Label>
          <Select
            value={field.type}
            onValueChange={(v) => {
              onUpdate({ type: v as TemplateField["type"] });
            }}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="range">Rango</SelectItem>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="select">Selección</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unit (number/range only) */}
        <div className="sm:col-span-1">
          {(field.type === "number" || field.type === "range") && (
            <>
              <Label className="text-xs">Unidades</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="g/dL, mg/L…"
                value={field.unit ?? ""}
                onChange={(e) => onUpdate({ unit: e.target.value || null })}
              />
            </>
          )}
        </div>
      </div>

      {/* Reference ranges (number/range only) */}
      {(field.type === "number" || field.type === "range") && (
        <div>
          <Label className="text-xs mb-1 block">Rangos de Referencia</Label>
          <ReferenceRangesEditor
            ranges={field.reference_ranges ?? []}
            onChange={(ranges) => onUpdate({ reference_ranges: ranges })}
          />
        </div>
      )}

      {(field.type === "select" || field.type === "text") && (
        <div>
          <OptionsEditor
            fieldType={field.type}
            fieldLabel={field.label}
            options={field.options ?? []}
            onChange={(opts) => onUpdate({ options: opts })}
          />
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end gap-1 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground text-xs h-7"
          onClick={onInsertAfter}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Insertar campo debajo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          title="Mover arriba"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onMoveDown}
          disabled={!onMoveDown}
          title="Mover abajo"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>

        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Eliminar campo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Options & Result Templates Editor ─────────────────────────────
function OptionsEditor({
  options,
  onChange,
  fieldType = "text",
  fieldLabel = "",
}: {
  options: string[];
  onChange: (opts: string[]) => void;
  fieldType?: string;
  fieldLabel?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftOptions, setDraftOptions] = useState<string[]>(options);

  function handleOpenDialog() {
    setDraftOptions(options.length > 0 ? [...options] : [""]);
    setDialogOpen(true);
  }

  function handleSaveDialog() {
    const filtered = draftOptions.map((o) => o.trim()).filter(Boolean);
    onChange(filtered);
    setDialogOpen(false);
  }

  const isText = fieldType === "text";

  return (
    <div className="flex flex-wrap gap-2 items-center pl-2 py-1.5 border-t border-border/40 mt-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
          {isText ? "Plantillas de resultado:" : "Opciones:"}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[11px] px-2 gap-1 text-primary hover:text-primary hover:bg-primary/5 border-primary/30"
          onClick={handleOpenDialog}
        >
          <FileText className="w-3 h-3" />
          {options.length > 0
            ? `${options.length} ${options.length === 1 ? (isText ? "plantilla" : "opción") : (isText ? "plantillas" : "opciones")}`
            : isText
              ? "+ Crear plantilla de resultado"
              : "+ Gestionar opciones"}
        </Button>
      </div>

      {/* Chips preview 
      <div className="flex flex-wrap gap-1.5 items-center">
        {options.map((opt, i) => {
          const firstLine = opt.split("\n")[0].trim();
          const displayLabel =
            firstLine.length > 25 ? firstLine.slice(0, 25) + "..." : firstLine || `Opción ${i + 1}`;
          const isMultiline = opt.includes("\n");

          return (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-secondary/80 hover:bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-[11px] cursor-pointer transition-colors"
              onClick={handleOpenDialog}
              title={opt}
            >
              <span className="truncate max-w-[150px] font-medium">{displayLabel}</span>
              {isMultiline && (
                <span className="text-[9px] bg-primary/15 text-primary px-1 rounded font-mono font-normal">
                  multilínea
                </span>
              )}
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive ml-0.5 text-xs font-bold leading-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(options.filter((_, j) => j !== i));
                }}
                title="Eliminar opción"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-primary" />
              {isText ? "Plantillas de Resultado Predefinidas" : "Opciones del Campo"}
              {fieldLabel ? (
                <span className="text-muted-foreground font-normal text-sm">
                  ({fieldLabel})
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isText
                ? "Configura las plantillas de resultado para este examen. Puedes pegar o escribir bloques de texto completos con saltos de línea (como en PCR, biopsias o cultivos). El bioanalista podrá cargar la plantilla con un solo clic al llenar la orden y modificar rápidamente solo los valores necesarios."
                : "Configura las opciones predefinidas para este campo."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {draftOptions.map((opt, idx) => (
              <div key={idx} className="rounded-lg border bg-card p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    {isText ? `Modelo de Resultado ${idx + 1}` : `Opción ${idx + 1}`}
                  </span>
                  {draftOptions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDraftOptions(draftOptions.filter((_, j) => j !== idx))}
                      title="Eliminar esta plantilla"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <Textarea
                  className="font-sans text-xs min-h-[140px] leading-relaxed p-3 bg-muted/30 focus:bg-background resize-y"
                  value={opt}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const textarea = e.currentTarget;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const tabSpaces = "    ";
                      const val = textarea.value;
                      const nextVal = val.substring(0, start) + tabSpaces + val.substring(end);
                      const next = [...draftOptions];
                      next[idx] = nextVal;
                      setDraftOptions(next);
                      requestAnimationFrame(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
                      });
                    }
                  }}
                  onChange={(e) => {
                    const next = [...draftOptions];
                    next[idx] = e.target.value;
                    setDraftOptions(next);
                  }}
                  placeholder={
                    isText
                      ? "Ejemplo:\nEXAMEN: Identificacion de SARS-CoV-2: qRT-PCR\nMUESTRA: HISOPADO NASOFARÍNGEO\nMÉTODO: PCR Tiempo real\nRESULTADO: NO DETECTADO\nGen E: Negativo\nGen N: Negativo\nGen RdRP: Negativo\nGen S: Negativo\nLímite de detección: 100 copias/mL"
                      : "Escribe la opción..."
                  }
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed text-xs py-4 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setDraftOptions([...draftOptions, ""])}
            >
              <Plus className="w-4 h-4" />
              {isText ? "Añadir otro modelo de resultado" : "Añadir otra opción"}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Tip: Los saltos de línea se respetarán tanto en el informe PDF como en la orden.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSaveDialog}>
                Guardar Plantillas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
