import { useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Ruler } from "lucide-react";
import { ReferenceRange } from "./schemas";
import { Badge } from "@/components/ui/badge";

const uuidv4 = () => crypto.randomUUID();

function emptyRange(): ReferenceRange {
  return {
    id: uuidv4(),
    gender: "ambos",
    age_min: null,
    age_max: null,
    min_value: 0,
    max_value: 0,
    description: "",
  };
}

const GENDER_LABELS: Record<string, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  ambos: "Ambos",
};

interface Props {
  ranges: ReferenceRange[];
  onChange: (ranges: ReferenceRange[]) => void;
}

export function ReferenceRangesEditor({ ranges, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function addRange() {
    onChange([...ranges, emptyRange()]);
  }

  function removeRange(idx: number) {
    onChange(ranges.filter((_, i) => i !== idx));
  }

  function updateRange(idx: number, patch: Partial<ReferenceRange>) {
    onChange(ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs flex items-center w-full"
        >
          <Ruler className="w-3 h-3" />
          Rangos ({ranges.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="start" side="bottom">
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-semibold">Rangos de Referencia</h4>
          <p className="text-xs text-muted-foreground">
            Define rangos por sexo y edad para alertas automáticas
          </p>
        </div>

        <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
          {ranges.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Sin rangos definidos. Añade uno para habilitar alertas.
            </p>
          )}

          {ranges.map((range, idx) => (
            <div
              key={range.id}
              className="border border-border rounded-lg p-3 space-y-2 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">
                  {GENDER_LABELS[range.gender]}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeRange(idx)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Descripción</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Ej: Varones adultos"
                    value={range.description}
                    onChange={(e) =>
                      updateRange(idx, { description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Sexo</Label>
                  <Select
                    value={range.gender}
                    onValueChange={(v) =>
                      updateRange(idx, {
                        gender: v as ReferenceRange["gender"],
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambos">Ambos</SelectItem>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Edad Min</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    placeholder="—"
                    value={range.age_min ?? ""}
                    onChange={(e) =>
                      updateRange(idx, {
                        age_min: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Edad Max</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    placeholder="—"
                    value={range.age_max ?? ""}
                    onChange={(e) =>
                      updateRange(idx, {
                        age_max: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Valor Mín</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    value={range.min_value}
                    onChange={(e) =>
                      updateRange(idx, { min_value: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Valor Máx</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    value={range.max_value}
                    onChange={(e) =>
                      updateRange(idx, { max_value: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={addRange}
          >
            <Plus className="w-3 h-3 mr-1" /> Añadir Rango
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
