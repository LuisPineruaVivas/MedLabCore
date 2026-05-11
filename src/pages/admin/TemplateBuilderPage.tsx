import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
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
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { TestReportPDF } from "@/lib/testReportGenerator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { createEmptyTemplateField, createEmptyTemplateSection, useSaveTemplate, useTemplateById } from "@/features/admin/useTemplateBuilder";

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
      }
    : undefined;

  const defaultValues: TestTemplateFormData = {
    name: "",
    category: "",
    base_price: 0,
    schema: { sections: [emptySection()] },
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
            (data) =>
              saveMutation.mutate(
                {
                  formData: data,
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
              ),
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
                    {value.message || "Revisa este campo"}
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
              </div>
            </CardContent>
          </Card>

          {/* ── Sections ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Secciones y Campos</h2>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Sección
              </Button>
            </div>

            {errors.schema?.sections && (
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
              <h3 className="font-medium text-sm">
                Vista Previa: {currentFormData.name || "Nuevo Examen"}
              </h3>
            </div>
            <div className="flex-1 bg-white">
              <PDFViewer width="100%" height="100%" showToolbar={true}>
                <TestReportPDF
                  template={{
                    id: existingTemplate?.id || "preview",
                    name: currentFormData.name,
                    category: currentFormData.category,
                    base_price: currentFormData.base_price,
                    schema: currentFormData.schema,
                    is_active: true,
                    org_id: null,
                    created_at: "",
                    updated_at: "",
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

// ── Options Editor ───────────────────────────────────────────────
function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center pl-2 py-1">
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        Opciones:
      </span>
      {options.map((opt, i) => (
        <div
          key={i}
          className="flex items-center gap-1 bg-secondary rounded px-2 py-0.5"
        >
          <Input
            className="h-5 w-32 text-[11px] border-none bg-transparent p-0"
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      { options.length < 10 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] px-1.5"
          onClick={() => onChange([...options, ""])}
        >
          + Agregar
        </Button>
      )}
    </div>
  );
}
