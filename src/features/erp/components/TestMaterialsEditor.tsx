import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItems } from "../hooks/useInventory";
import { useDeleteTestMaterial, useSaveTestMaterial, useTestMaterials } from "../hooks/useTestMaterials";
import { formatCurrency } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { UNIT_LABELS } from "../utils/inventory";

interface TestMaterialsEditorProps {
  orgId: string | null;
  templateId: string;
  canEdit: boolean;
}

/** Recipe (BOM) of one exam: the supplies it consumes by default and their estimated cost. */
export function TestMaterialsEditor({ orgId, templateId, canEdit }: TestMaterialsEditorProps) {
  const { data: materials = [], isLoading } = useTestMaterials(orgId, templateId);
  const { data: items = [] } = useItems(orgId);
  const save = useSaveTestMaterial(orgId, templateId);
  const remove = useDeleteTestMaterial(orgId, templateId);
  const [newItemId, setNewItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const usedItemIds = new Set(materials.map((material) => material.item_id));
  const available = items.filter((item) => item.is_active && !usedItemIds.has(item.id));
  const estimatedCost = materials.reduce((sum, material) => sum + Number(material.quantity_per_test) * Number(material.items?.unit_cost ?? 0), 0);
  const onError = (error: unknown) => toast.error(getErpErrorMessage(error));

  function handleAdd() {
    const quantity = Number(newQuantity.replace(",", "."));
    if (!newItemId || !(quantity > 0)) {
      toast.error("Selecciona un insumo y una cantidad mayor que cero.");
      return;
    }
    save.mutate(
      { item_id: newItemId, quantity_per_test: quantity },
      {
        onSuccess: () => {
          setNewItemId("");
          setNewQuantity("1");
        },
        onError,
      }
    );
  }

  function commitQuantity(materialId: string, itemId: string, current: number) {
    const raw = drafts[materialId];
    if (raw === undefined) return;
    const quantity = Number(raw.replace(",", "."));
    setDrafts((current) => {
      const next = { ...current };
      delete next[materialId];
      return next;
    });
    if (!(quantity > 0)) {
      toast.error("La cantidad debe ser mayor que cero.");
      return;
    }
    if (quantity !== current) save.mutate({ item_id: itemId, quantity_per_test: quantity }, { onError });
  }

  if (!items.length && !isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay insumos en el inventario. <Link to="/erp/inventory" className="text-primary hover:underline">Crea los insumos</Link> para armar la receta.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="w-32 text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo est.</TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}>Cargando receta...</TableCell></TableRow>
            ) : materials.length ? (
              materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    <p className="font-medium">{material.items?.name ?? "Insumo"}</p>
                    {material.items && !material.items.is_active && <p className="text-xs text-destructive">Inactivo: no se descontará</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          className="h-8 w-20 text-right"
                          inputMode="decimal"
                          value={drafts[material.id] ?? String(Number(material.quantity_per_test))}
                          onChange={(event) => setDrafts((current) => ({ ...current, [material.id]: event.target.value }))}
                          onBlur={() => commitQuantity(material.id, material.item_id, Number(material.quantity_per_test))}
                        />
                        <span className="text-xs text-muted-foreground">{material.items ? UNIT_LABELS[material.items.unit_of_measure] : ""}</span>
                      </div>
                    ) : (
                      `${Number(material.quantity_per_test)} ${material.items ? UNIT_LABELS[material.items.unit_of_measure] : ""}`
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(material.quantity_per_test) * Number(material.items?.unit_cost ?? 0))}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="icon" variant="ghost" title="Quitar de la receta" onClick={() => remove.mutate(material.id, { onError })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Este examen aún no tiene insumos asignados.</TableCell></TableRow>
            )}
          </TableBody>
          {materials.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Costo estimado por examen</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(estimatedCost)}</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={newItemId} onValueChange={setNewItemId}>
            <SelectTrigger className="sm:flex-1"><SelectValue placeholder={available.length ? "Agregar insumo..." : "Todos los insumos ya están en la receta"} /></SelectTrigger>
            <SelectContent>
              {available.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name} ({UNIT_LABELS[item.unit_of_measure]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="sm:w-24" inputMode="decimal" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} aria-label="Cantidad por examen" />
          <Button onClick={handleAdd} disabled={save.isPending || !newItemId}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">El costo estimado usa el costo promedio actual de cada insumo.</p>
    </div>
  );
}
