import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { TemplateField } from "@/features/tests/schemas";
import { ReferenceRangesEditor } from "@/features/tests/ReferenceRangesEditor";
import { OptionsEditor } from "./TemplateOptionsEditor";

export function FieldRow({
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
