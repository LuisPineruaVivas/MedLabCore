import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, FlaskConical, FileText } from "lucide-react";
import type { MicrobiologyFieldDef } from "@/features/microbiology/types";

/** One of the lab's free-text fields: rename or delete it. */
function CustomFieldRow({
  field,
  removeMicroField,
  updateMicroFieldLabel,
}: {
  field: MicrobiologyFieldDef;
  removeMicroField: (id: string) => void;
  updateMicroFieldLabel: (id: string, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground mb-1 block">
          Campo personalizado (texto libre)
        </Label>
        <Input
          className="h-8 text-sm"
          placeholder="Ej. Observaciones, Notas..."
          value={field.label}
          onChange={(e) => updateMicroFieldLabel(field.id, e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
        onClick={() => removeMicroField(field.id)}
        title="Eliminar campo"
        aria-label={`Eliminar campo ${field.label || "personalizado"}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

/** Labels of the fixed microbiology fields and the lab's extra free-text fields, before and after the culture. */
export function MicrobiologyFieldsEditor({
  specimenFields,
  additionalMicroFields,
  afterCultureFields,
  cultureResultField,
  addMicroField,
  removeMicroField,
  updateMicroFieldLabel,
}: {
  specimenFields: MicrobiologyFieldDef[];
  additionalMicroFields: MicrobiologyFieldDef[];
  afterCultureFields: MicrobiologyFieldDef[];
  cultureResultField: MicrobiologyFieldDef | undefined;
  addMicroField: (position?: "after") => void;
  removeMicroField: (id: string) => void;
  updateMicroFieldLabel: (id: string, label: string) => void;
}) {
  return (
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
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
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
              onClick={() => addMicroField()}
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
              <CustomFieldRow key={mField.id} field={mField} removeMicroField={removeMicroField} updateMicroFieldLabel={updateMicroFieldLabel} />
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
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              Campo fijo
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
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Campos después del antibiograma
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addMicroField("after")}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agregar campo al final
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Estos campos de texto libre aparecen al final del informe, después del resultado del cultivo y del antibiograma (por ejemplo, observaciones o notas).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {afterCultureFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay campos al final.</p>
          ) : (
            afterCultureFields.map((mField) => (
              <CustomFieldRow key={mField.id} field={mField} removeMicroField={removeMicroField} updateMicroFieldLabel={updateMicroFieldLabel} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
