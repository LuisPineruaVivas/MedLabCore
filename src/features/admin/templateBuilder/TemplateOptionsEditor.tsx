import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function OptionsEditor({
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
