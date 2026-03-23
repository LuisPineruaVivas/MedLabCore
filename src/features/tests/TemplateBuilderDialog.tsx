import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
const uuidv4 = () => crypto.randomUUID();
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  GripVertical,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  ListPlus,
} from "lucide-react";
import {
  testTemplateFormSchema,
  TestTemplateFormData,
  TemplateSection,
  TemplateField,
  TEMPLATE_CATEGORIES,
  ReferenceRange,
} from "./schemas";
import { ReferenceRangesEditor } from "./ReferenceRangesEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PDFViewer } from '@react-pdf/renderer';
import { TestReportPDF } from '@/lib/testReportGenerator'; 
import { Eye } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────
function emptyField(): TemplateField {
  return { id: uuidv4(), label: "", type: "number", unit: null, range: null, reference_ranges: [] };
}

function emptySection(): TemplateSection {
  return { id: uuidv4(), name: "", fields: [emptyField()] };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TestTemplateFormData) => void;
  initialData?: TestTemplateFormData;
  isSaving?: boolean;
  title?: string;
}

export function TemplateBuilderDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
  isSaving,
  title = "Crear / Editar Plantilla de Examen",
}: Props) {
  const defaultValues: TestTemplateFormData = initialData ?? {
    name: "",
    category: "",
    base_price: 0,
    schema: { sections: [emptySection()] },
  };

  const form = useForm<TestTemplateFormData>({
    resolver: zodResolver(testTemplateFormSchema),
    defaultValues,
    values: initialData ?? undefined,
  });

  useEffect(() => {
    if (open) {
      form.reset(initialData ?? defaultValues);
    }
  }, [open, initialData]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const sections = watch("schema.sections");

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

  // ── Collapsed state ─────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showLivePreview, setShowLivePreview] = useState(false);

  const currentFormData = watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Crea o edita la plantilla de examen definiendo sus secciones y campos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <form
            id="template-builder-form"
            onSubmit={handleSubmit(onSave, (validationErrors) => {
                console.log("❌ Zod Errors Detail:", validationErrors);
              })}
            className="space-y-5 pb-4 px-2"
          >
            {/* ── Meta fields ──────────────────────────── */}
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
                  <p className="text-xs text-destructive">{errors.category.message}</p>
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
                  <p className="text-xs text-destructive">{errors.base_price.message}</p>
                )}
              </div>
            </div>

            {/* ── Sections ─────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Secciones y Campos</h3>
                <Button type="button" variant="outline" size="sm" onClick={addSection}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Sección
                </Button>
              </div>

              {errors.schema?.sections && (
                <p className="text-xs text-destructive">
                  {typeof errors.schema.sections.message === "string"
                    ? errors.schema.sections.message
                    : "Check sections"}
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
                  <div className="border border-border rounded-lg bg-muted/30">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
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
                        placeholder="Section name (e.g. Physical Analysis)"
                        value={section.name}
                        onChange={(e) => updateSectionName(sIdx, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {section.fields.length} field{section.fields.length !== 1 ? "s" : ""}
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
                      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
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
                          className="text-xs"
                          onClick={() => addField(sIdx)}
                        >
                          <ListPlus className="w-3.5 h-3.5 mr-1" /> Agregar Campo
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {Object.keys(errors).length > 0 && (
                <div className="mx-6 my-4 p-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-sm font-bold text-red-600 mb-2">
                    Error: El formulario tiene campos inválidos:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {Object.entries(errors).map(([key, value]) => (
                      <li key={key} className="text-xs text-red-500 font-medium">
                        <span className="uppercase">{key}</span>: {value.message || "Revisa este campo"}
                        {value.root && <span className="block italic">{value.root.message}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => setShowLivePreview(true)}
          >
            <Eye className="w-4 h-4 mr-2" />
            Vista Previa
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="template-builder-form" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar Plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>


      <Dialog open={showLivePreview} onOpenChange={setShowLivePreview}>
        <DialogTitle className="text-black">Vista Previa Examen</DialogTitle>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden border-none">
          <div className="flex flex-col h-full">
            <div className="p-4 flex justify-between items-center text-white">
              <h3 className="font-medium text-black text-sm">Vista Previa Examen: {currentFormData.name || 'Nuevo Examen'}</h3>
            </div>
            
            <div className="flex-1 bg-white">
              <PDFViewer width="100%" height="100%" showToolbar={true}>
                <TestReportPDF 
                  // Pasamos currentFormData transformado al tipo TestTemplateRow
                  template={{
                    id: initialData?.id || 'preview',
                    name: currentFormData.name,
                    category: currentFormData.category,
                    base_price: currentFormData.base_price,
                    schema: currentFormData.schema,
                    is_active: true,
                    org_id: null,
                    created_at: '',
                    updated_at: ''
                  }} 
                />
              </PDFViewer>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      
    </Dialog>
  );
}

// ── Field Row ───────────────────────────────────────────────────
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
    <div className="grid grid-cols-5 gap-2 items-start">

      <div>
        <Label>Nombre del Campo</Label>
        <Input
        className="h-8 text-xs"
        placeholder="e.g. Hemoglobina"
        value={field.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </div>
      
      <div>
        <Label>Tipo de Dato</Label>
        <Select
          value={field.type}
          onValueChange={(v) => {
            onUpdate({ type: v as TemplateField["type"] });
            setShowOptions(v === "select");
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Numero</SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="select">Seleccion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {field.type === "number" && (
        <>
          <div>
            <Label>Unidades</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Unidades"
              value={field.unit ?? ""}
              onChange={(e) => onUpdate({ unit: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Rangos</Label>
            <ReferenceRangesEditor
              ranges={field.reference_ranges ?? []}
              onChange={(ranges) => onUpdate({ reference_ranges: ranges })}
            />
          </div>
        </>
      )}
      
      
      {onRemove ? (
        <div className="flex flex-col">
          <Label className="invisible">Remove</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-12 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-8"/>
          </Button>
        </div>
      ) : (
        <div className="w-8" />
      )}

      {/* Select options row */}
      {showOptions && (
        <div className="col-span-5">
          <OptionsEditor
            options={field.options ?? []}
            onChange={(opts) => onUpdate({ options: opts })}
          />
        </div>
      )}
    </div>
  );
}

// ── Options editor (for select fields) ──────────────────────────
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
        Options:
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
        + Add
      </Button>
    </div>
  );
}
