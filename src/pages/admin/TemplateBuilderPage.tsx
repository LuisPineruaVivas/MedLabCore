import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FlaskConical, ArrowLeft, Eye, Save } from "lucide-react";
import { testTemplateFormSchema, TestTemplateFormData, TemplateSection, TemplateField } from "@/features/tests/schemas";
import { getTestTemplateReportComponent } from "@/lib/orderReportDispatcher";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { createEmptyTemplateField, createEmptyTemplateSection, useSaveTemplate, useTemplateById } from "@/features/admin/useTemplateBuilder";
import { type MicrobiologyFieldDef, getMicrobiologyFields } from "@/features/microbiology/types";
import { TemplateMetaFieldsCard } from "@/features/admin/templateBuilder/TemplateMetaFieldsCard";
import { MicrobiologyFieldsEditor } from "@/features/admin/templateBuilder/MicrobiologyFieldsEditor";
import { TemplateSectionsEditor } from "@/features/admin/templateBuilder/TemplateSectionsEditor";
import { TemplatePreviewDialog } from "@/features/admin/templateBuilder/TemplatePreviewDialog";
import {
  appendField,
  insertFieldAfter as insertFieldAfterOp,
  moveField,
  patchField,
  removeFieldAt,
  renameSection,
} from "@/features/admin/templateBuilder/templateSectionOps";

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

  // schema is z.any() in the form schema; its sections follow TemplateSection.
  const sections = watch("schema.sections") as TemplateSection[];
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
    setValue("schema.sections", renameSection(sections, idx, name));
  }

  // ── Field CRUD ──────────────────────────────────────────────
  function addField(sIdx: number) {
    setValue("schema.sections", appendField(sections, sIdx, emptyField()));
  }

  function removeField(sIdx: number, fIdx: number) {
    setValue("schema.sections", removeFieldAt(sections, sIdx, fIdx));
  }

  function updateField(sIdx: number, fIdx: number, patch: Partial<TemplateField>) {
    setValue("schema.sections", patchField(sections, sIdx, fIdx, patch));
  }

  function moveFieldUp(sIdx: number, fIdx: number) {
    setValue("schema.sections", moveField(sections, sIdx, fIdx, -1));
  }

  function moveFieldDown(sIdx: number, fIdx: number) {
    setValue("schema.sections", moveField(sections, sIdx, fIdx, 1));
  }

  function insertFieldAfter(sIdx: number, fIdx: number) {
    setValue("schema.sections", insertFieldAfterOp(sections, sIdx, fIdx, emptyField()));
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
          <TemplateMetaFieldsCard register={register} control={control} errors={errors} />

          {/* ── Sections or Microbiology Fields Editor ── */}
          {currentFormData.result_type === "MICROBIOLOGY" ? (
            <MicrobiologyFieldsEditor
              specimenFields={specimenFields}
              additionalMicroFields={additionalMicroFields}
              cultureResultField={cultureResultField}
              addMicroField={addMicroField}
              removeMicroField={removeMicroField}
              updateMicroFieldLabel={updateMicroFieldLabel}
            />
          ) : (
            <TemplateSectionsEditor
              sections={sections}
              errors={errors}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              addSection={addSection}
              removeSection={removeSection}
              updateSectionName={updateSectionName}
              addField={addField}
              removeField={removeField}
              updateField={updateField}
              moveFieldUp={moveFieldUp}
              moveFieldDown={moveFieldDown}
              insertFieldAfter={insertFieldAfter}
            />
          )}
        </form>
      </div>

      <TemplatePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        PreviewReport={PreviewReport}
        currentFormData={currentFormData}
        microbiologyFields={microbiologyFields}
        templateId={existingTemplate?.id}
        labData={getLabData(organization)}
      />
    </div>
  );
}
