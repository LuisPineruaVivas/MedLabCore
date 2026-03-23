import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Search, Check, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    total_price: number;
    template_ids: string[];
  }) => void;
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    total_price: number;
    template_ids: string[];
  };
  isSaving: boolean;
  orgId: string;
}

export function ProfileBuilderDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
  isSaving,
  orgId,
}: ProfileBuilderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
      setTotalPrice(String(initialData.total_price));
      setSelectedTemplateIds(initialData.template_ids);
    } else if (open) {
      setName("");
      setDescription("");
      setTotalPrice("");
      setSelectedTemplateIds([]);
    }
    setTemplateSearch("");
  }, [open, initialData]);

  // Fetch available templates
  const { data: templates = [] } = useQuery({
    queryKey: ["profile-builder-templates", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_test_templates_filtered")
        .select("id, name, category, base_price")
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && open,
  });

  const filteredTemplates = templateSearch.trim()
    ? templates.filter(
        (t) =>
          t.name?.toLowerCase().includes(templateSearch.toLowerCase()) ||
          t.category?.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates;

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    if (!name.trim() || selectedTemplateIds.length === 0) return;
    onSave({
      id: initialData?.id,
      name: name.trim(),
      description: description.trim(),
      total_price: Number(totalPrice) || 0,
      template_ids: selectedTemplateIds,
    });
  }

  const individualTotal = templates
    .filter((t) => selectedTemplateIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.base_price), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Perfil" : "Nuevo Perfil de Exámenes"}
          </DialogTitle>
          <DialogDescription>
            Agrupa varios exámenes en un paquete con un precio promocional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nombre del Perfil</Label>
            <Input
              placeholder="Ej: Perfil 20, Perfil Básico..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Descripción (opcional)</Label>
            <Textarea
              placeholder="Breve descripción del perfil..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Precio del Perfil (USD)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="20.00"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="max-w-[180px]"
              />
              {selectedTemplateIds.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Precio individual total: <span className="font-semibold text-foreground">${individualTotal.toFixed(2)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Exámenes Incluidos ({selectedTemplateIds.length} seleccionados)
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar examen..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>

            {/* Selected chips */}
            {selectedTemplateIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {selectedTemplateIds.map((id) => {
                  const tpl = templates.find((t) => t.id === id);
                  if (!tpl) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      {tpl.name}
                      <button
                        type="button"
                        onClick={() => toggleTemplate(id)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Template list */}
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
              {filteredTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se encontraron exámenes
                </p>
              ) : (
                filteredTemplates.map((tpl) => {
                  const isSelected = selectedTemplateIds.includes(tpl.id);
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors",
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => toggleTemplate(tpl.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground">{tpl.category}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold mono text-muted-foreground">
                        ${Number(tpl.base_price).toFixed(2)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || selectedTemplateIds.length === 0 || isSaving}
          >
            {isSaving ? "Guardando…" : initialData ? "Guardar Cambios" : "Crear Perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
