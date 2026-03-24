import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const uuidv4 = () => crypto.randomUUID();

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
} from "lucide-react";
import {
  testTemplateFormSchema,
  TestTemplateFormData,
  TemplateSection,
  TemplateField,
  TEMPLATE_CATEGORIES,
  ReferenceRange,
} from "@/features/tests/schemas";
import { TestTemplateRow } from "@/features/tests/schemas";
import { ReferenceRangesEditor } from "@/features/tests/ReferenceRangesEditor";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PDFViewer } from "@react-pdf/renderer";
import { TestReportPDF } from "@/lib/testReportGenerator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Helpers ──────────────────────────────────────────────────────
function emptyField(): TemplateField {
  return {
    id: uuidv4(),
    label: "",
    type: "number",
    unit: null,
    range: null,
    reference_ranges: [],
  };
}

function emptySection(): TemplateSection {
  return { id: uuidv4(), name: "", fields: [emptyField()] };
}

// ── Main Page ────────────────────────────────────────────────────
export default function TemplateBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isFork = searchParams.get("fork") === "1";
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // ── Fetch existing template if editing ──────────────────────
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["test-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as TestTemplateRow;
    },
    enabled: !!id,
  });

  // ── Fetch profile for org_id ────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

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

  // ── Collapsed state ──────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);

  // ── Save mutation ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (formData: TestTemplateFormData) => {
      const row = {
        name: formData.name,
        category: formData.category,
        base_price: formData.base_price,
        schema: formData.schema as unknown as import("@/integrations/supabase/types").Json,
        updated_at: new Date().toISOString(),
      };

      if (isFork || !id) {
        // Insert new
        const { error } = await supabase.from("test_templates").insert([
          {
            ...row,
            org_id: isSuperAdmin ? null : orgId ?? null,
          },
        ]);
        if (error) throw error;
      } else {
        // Update existing
        const { error } = await supabase
          .from("test_templates")
          .update({
            ...row,
            org_id:
              isSuperAdmin && existingTemplate?.org_id === null
                ? null
                : orgId ?? null,
          })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
      toast.success(isFork || !id ? "Plantilla creada" : "Plantilla actualizada");
      navigate("/admin/tests-templates");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

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

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Header + Save Bar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/tests-templates")}
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
              Vista Previa
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-blue-600 sm:hidden"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              form="template-builder-form"
              type="submit"
              disabled={saveMutation.isPending}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Guardando…" : "Guardar Plantilla"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <form
          id="template-builder-form"
          onSubmit={handleSubmit(
            (data) => saveMutation.mutate(data),
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
        <DialogTitle className="sr-only">Vista Previa del Examen</DialogTitle>
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
}: {
  field: TemplateField;
  onUpdate: (patch: Partial<TemplateField>) => void;
  onRemove?: () => void;
}) {
  const [showOptions, setShowOptions] = useState(field.type === "select");

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
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
        <div>
          <Label className="text-xs">Tipo de Dato</Label>
          <Select
            value={field.type}
            onValueChange={(v) => {
              onUpdate({ type: v as TemplateField["type"] });
              setShowOptions(v === "select");
            }}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="select">Selección</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unit (number only) */}
        {field.type === "number" && (
          <div>
            <Label className="text-xs">Unidades</Label>
            <Input
              className="h-8 text-xs mt-1"
              placeholder="g/dL, mg/L…"
              value={field.unit ?? ""}
              onChange={(e) => onUpdate({ unit: e.target.value || null })}
            />
          </div>
        )}

        {/* Delete */}
        {onRemove && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Reference ranges (number only) */}
      {field.type === "number" && (
        <div>
          <Label className="text-xs mb-1 block">Rangos de Referencia</Label>
          <ReferenceRangesEditor
            ranges={field.reference_ranges ?? []}
            onChange={(ranges) => onUpdate({ reference_ranges: ranges })}
          />
        </div>
      )}

      {/* Options editor (select only) */}
      {showOptions && (
        <div>
          <OptionsEditor
            options={field.options ?? []}
            onChange={(opts) => onUpdate({ options: opts })}
          />
        </div>
      )}
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
            className="h-5 w-20 text-[11px] border-none bg-transparent p-0"
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-5 text-[10px] px-1.5"
        onClick={() => onChange([...options, ""])}
      >
        + Agregar
      </Button>
    </div>
  );
}
