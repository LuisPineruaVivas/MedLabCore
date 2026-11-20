import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import { TestTemplateFormData, TemplateSection, TemplateField } from "@/features/tests/schemas";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { FieldErrors } from "react-hook-form";
import type { Dispatch, SetStateAction } from "react";
import { FieldRow } from "./TemplateFieldRow";

/** Sections of a standard template and their fields (add, rename, reorder, remove). */
export function TemplateSectionsEditor({
  sections,
  errors,
  collapsed,
  setCollapsed,
  addSection,
  removeSection,
  updateSectionName,
  addField,
  removeField,
  updateField,
  moveFieldUp,
  moveFieldDown,
  insertFieldAfter,
}: {
  sections: TemplateSection[];
  errors: FieldErrors<TestTemplateFormData>;
  collapsed: Record<number, boolean>;
  setCollapsed: Dispatch<SetStateAction<Record<number, boolean>>>;
  addSection: () => void;
  removeSection: (sIdx: number) => void;
  updateSectionName: (sIdx: number, name: string) => void;
  addField: (sIdx: number) => void;
  removeField: (sIdx: number, fIdx: number) => void;
  updateField: (sIdx: number, fIdx: number, patch: Partial<TemplateField>) => void;
  moveFieldUp: (sIdx: number, fIdx: number) => void;
  moveFieldDown: (sIdx: number, fIdx: number) => void;
  insertFieldAfter: (sIdx: number, fIdx: number) => void;
}) {
  return (
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
  );
}
