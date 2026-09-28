import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAntibiotics, useCreateAntibiotic } from "./useAntibiotics";
import { 
  type MicrobiologyResultsData, 
  type SensitivityValue,
  type AntibiogramEntry,
  getGermSensitivity,
} from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface MicrobiologyResultFormProps {
  itemId: string;
  itemResultsData: MicrobiologyResultsData;
  readOnly: boolean;
  updateMicroField: (itemId: string, field: keyof Omit<MicrobiologyResultsData, 'result_type' | 'antibiogram' | 'isolated_germs'>, value: string) => void;
  updateMicroGerms: (itemId: string, germs: string[]) => void;
  updateAntibiogram: (itemId: string, antibioticIdx: number, sensitivity: SensitivityValue, germIndex?: number) => void;
  addAntibiogram: (itemId: string, entry: AntibiogramEntry) => void;
}

export function MicrobiologyResultForm({
  itemId,
  itemResultsData,
  readOnly,
  updateMicroField,
  updateMicroGerms,
  updateAntibiogram,
  addAntibiogram,
}: MicrobiologyResultFormProps) {
  const { data: antibiotics = [] } = useAntibiotics({ activeOnly: true });
  const createAntibiotic = useCreateAntibiotic();
  const [newAntibioticName, setNewAntibioticName] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const germs = itemResultsData.isolated_germs && itemResultsData.isolated_germs.length > 0
    ? itemResultsData.isolated_germs
    : itemResultsData.culture_result
      ? itemResultsData.culture_result.split("\n").map(s => s.trim()).filter(Boolean)
      : [""];

  const antibiogram = itemResultsData.antibiogram || [];

  const handleGermChange = (idx: number, value: string) => {
    if (readOnly) return;
    const nextGerms = [...germs];
    nextGerms[idx] = value;
    updateMicroGerms(itemId, nextGerms);
  };

  const handleAddGerm = () => {
    if (readOnly || germs.length >= 3) return;
    updateMicroGerms(itemId, [...germs, ""]);
  };

  const handleRemoveGerm = (idx: number) => {
    if (readOnly || germs.length <= 1) return;
    const nextGerms = germs.filter((_, i) => i !== idx);
    updateMicroGerms(itemId, nextGerms);
  };

  const handleSensitivityClick = (
    antibioticIdx: number, 
    germIndex: number, 
    currentValue: SensitivityValue, 
    newValue: SensitivityValue
  ) => {
    if (readOnly) return;
    const finalValue = currentValue === newValue ? null : newValue;
    updateAntibiogram(itemId, antibioticIdx, finalValue, germIndex);
  };

  const handleAddAntibiotic = async () => {
    const trimmed = newAntibioticName.trim();
    if (!trimmed) return;
    
    try {
      const newAb = await createAntibiotic.mutateAsync(trimmed);
      
      addAntibiogram(itemId, {
        antibiotic_id: newAb.id,
        antibiotic_name: newAb.name,
        sensitivity: null,
      });
      
      setNewAntibioticName("");
      setPopoverOpen(false);
      toast.success("Antibiótico añadido al catálogo y al antibiograma");
    } catch {
      toast.error("Error al añadir el antibiótico. Puede que ya exista.");
    }
  };

  const handleAddExistingToAntibiogram = (ab: { id: string; name: string }) => {
    addAntibiogram(itemId, {
      antibiotic_id: ab.id,
      antibiotic_name: ab.name,
      sensitivity: null,
    });
    setPopoverOpen(false);
  };

  const unassignedAntibiotics = antibiotics.filter(
    (ab) => !antibiogram.some((entry) => entry.antibiotic_id === ab.id)
  );

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-4">
        {/* Sample Type */}
        <div className="grid grid-cols-12 items-center gap-3">
          <Label className="col-span-12 sm:col-span-3 font-semibold text-foreground">
            TIPO DE MUESTRA
          </Label>
          <div className="col-span-12 sm:col-span-9">
            <Input
              value={itemResultsData.sample_type || ""}
              onChange={(e) => updateMicroField(itemId, "sample_type", e.target.value)}
              disabled={readOnly}
              placeholder="Ej. Orina, Heces, Secreción..."
              className="max-w-md h-8 text-sm"
            />
          </div>
        </div>

        {/* Gram Stain */}
        <div className="space-y-2">
          <Label className="font-semibold text-foreground">
            COLORACIÓN DE GRAM / EXAMEN DIRECTO
          </Label>
          <Textarea
            value={itemResultsData.gram_stain || ""}
            onChange={(e) => updateMicroField(itemId, "gram_stain", e.target.value)}
            disabled={readOnly}
            placeholder="Resultados del examen macroscópico o tinción..."
            className="min-h-[80px] text-sm whitespace-pre-wrap"
          />
        </div>

        {/* Isolated Germs (Dynamic up to 3) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-foreground">
              RESULTADO DE CULTIVO (Germen(es) Aislado(s))
            </Label>
            {!readOnly && germs.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddGerm}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar Germen ({germs.length}/3)
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {germs.map((germ, gIdx) => (
              <div key={gIdx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-6">
                  {gIdx + 1}.-
                </span>
                <Input
                  value={germ}
                  onChange={(e) => handleGermChange(gIdx, e.target.value)}
                  disabled={readOnly}
                  placeholder={`Ej. ${gIdx === 0 ? "Escherichia coli" : gIdx === 1 ? "Staphylococcus aureus" : "Germen 3"}`}
                  className="flex-1 h-8 text-sm"
                />
                {!readOnly && germs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRemoveGerm(gIdx)}
                    title="Eliminar germen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            * Cada germen aislado creará su propia columna en la tabla del antibiograma (máximo 3 gérmenes).
          </p>
        </div>

        {/* Antibiogram */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-foreground">ANTIBIOGRAMA</Label>
            
            {!readOnly && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar Antibiótico
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Agregar Antibiótico</h4>
                    
                    {unassignedAntibiotics.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border rounded-md p-1">
                        {unassignedAntibiotics.map((ab) => (
                          <div
                            key={ab.id}
                            className="text-xs p-1.5 hover:bg-muted cursor-pointer rounded"
                            onClick={() => handleAddExistingToAntibiogram(ab)}
                          >
                            + {ab.name}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Nuevo antibiótico..."
                        value={newAntibioticName}
                        onChange={(e) => setNewAntibioticName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!newAntibioticName.trim() || createAntibiotic.isPending}
                        onClick={handleAddAntibiotic}
                      >
                        Crear
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted text-xs uppercase border-b">
                <tr>
                  <th className="px-3 py-2 font-semibold">Antibiótico</th>
                  {germs.map((germ, gIdx) => (
                    <th key={gIdx} className="px-3 py-2 text-center border-l font-semibold" colSpan={3}>
                      <span className="block truncate max-w-[150px]">
                        {germ.trim() ? `${gIdx + 1}. ${germ.trim()}` : `Germen ${gIdx + 1}`}
                      </span>
                      <div className="flex justify-around text-[10px] mt-1 pt-1 border-t">
                        <span className="text-green-600 font-bold" title="Sensible">S</span>
                        <span className="text-yellow-600 font-bold" title="Intermedio">I</span>
                        <span className="text-red-600 font-bold" title="Resistente">R</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {antibiogram.length === 0 ? (
                  <tr>
                    <td colSpan={1 + germs.length * 3} className="px-3 py-4 text-center text-muted-foreground">
                      No hay antibióticos en el antibiograma.
                    </td>
                  </tr>
                ) : (
                  antibiogram.map((entry, idx) => (
                    <tr key={entry.antibiotic_id} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-medium">{entry.antibiotic_name}</td>
                      
                      {germs.map((_, gIdx) => {
                        const sens = getGermSensitivity(entry, gIdx);
                        return (
                          <React.Fragment key={gIdx}>
                            <td className="px-1 py-1.5 text-center border-l">
                              <button
                                className={`w-5 h-5 mx-auto rounded-full border text-[11px] flex items-center justify-center transition-colors ${
                                  sens === "S"
                                    ? "bg-green-100 border-green-500 text-green-700 font-bold shadow-sm"
                                    : "bg-transparent border-input text-transparent hover:bg-muted"
                                } ${readOnly ? "cursor-default opacity-80" : "cursor-pointer"}`}
                                onClick={() => handleSensitivityClick(idx, gIdx, sens, "S")}
                                disabled={readOnly}
                                type="button"
                              >
                                S
                              </button>
                            </td>
                            
                            <td className="px-1 py-1.5 text-center">
                              <button
                                className={`w-5 h-5 mx-auto rounded-full border text-[11px] flex items-center justify-center transition-colors ${
                                  sens === "I"
                                    ? "bg-yellow-100 border-yellow-500 text-yellow-700 font-bold shadow-sm"
                                    : "bg-transparent border-input text-transparent hover:bg-muted"
                                } ${readOnly ? "cursor-default opacity-80" : "cursor-pointer"}`}
                                onClick={() => handleSensitivityClick(idx, gIdx, sens, "I")}
                                disabled={readOnly}
                                type="button"
                              >
                                I
                              </button>
                            </td>
                            
                            <td className="px-1 py-1.5 text-center">
                              <button
                                className={`w-5 h-5 mx-auto rounded-full border text-[11px] flex items-center justify-center transition-colors ${
                                  sens === "R"
                                    ? "bg-red-100 border-red-500 text-red-700 font-bold shadow-sm"
                                    : "bg-transparent border-input text-transparent hover:bg-muted"
                                } ${readOnly ? "cursor-default opacity-80" : "cursor-pointer"}`}
                                onClick={() => handleSensitivityClick(idx, gIdx, sens, "R")}
                                disabled={readOnly}
                                type="button"
                              >
                                R
                              </button>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            * Los antibióticos sin sensibilidad asignada (S, I, R) no aparecerán en el informe impreso.
          </p>
        </div>
      </div>
    </div>
  );
}
