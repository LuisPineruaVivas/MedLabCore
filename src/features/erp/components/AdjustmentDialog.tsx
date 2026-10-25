import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterAdjustment } from "../hooks/useInventory";
import { adjustmentSchema, type AdjustmentFormValues } from "../schemas/inventorySchemas";
import type { Item } from "../types";
import { formatCurrency, formatUnitCost } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { formatQuantity } from "../utils/inventory";

interface AdjustmentDialogProps {
  orgId: string | null;
  items: Item[];
  itemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyValues = (itemId?: string | null): AdjustmentFormValues => ({ item_id: itemId ?? "", direction: "out", quantity: 0, reason: "" });

export function AdjustmentDialog({ orgId, items, itemId, open, onOpenChange }: AdjustmentDialogProps) {
  const adjust = useRegisterAdjustment(orgId);
  const form = useForm<AdjustmentFormValues>({ resolver: zodResolver(adjustmentSchema), defaultValues: emptyValues(itemId) });

  useEffect(() => {
    if (open) form.reset(emptyValues(itemId));
  }, [open, itemId, form]);

  const selected = items.find((item) => item.id === form.watch("item_id"));
  const direction = form.watch("direction");
  const quantity = Number(form.watch("quantity")) || 0;
  const resulting = selected ? Number(selected.current_stock) + (direction === "in" ? quantity : -quantity) : null;
  const error = (name: keyof AdjustmentFormValues) => form.formState.errors[name]?.message;

  function onSubmit(values: AdjustmentFormValues) {
    adjust.mutate(values, {
      onSuccess: (result) => {
        toast.success(`Ajuste registrado. Stock: ${formatQuantity(result?.new_stock, selected?.unit_of_measure)}.`);
        onOpenChange(false);
      },
      onError: (mutationError) => toast.error(getErpErrorMessage(mutationError)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste de inventario</DialogTitle>
          <DialogDescription>Corrige diferencias de conteo físico, pérdidas, roturas o vencimientos. Se valora al costo promedio actual.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label>Insumo</Label>
            <Select value={form.watch("item_id")} onValueChange={(value) => form.setValue("item_id", value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un insumo" /></SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-destructive">{error("item_id")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={direction} onValueChange={(value) => form.setValue("direction", value as "in" | "out")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Salida (pérdida, vencido, rotura)</SelectItem>
                  <SelectItem value="in">Entrada (sobrante de conteo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjust-qty">Cantidad</Label>
              <Input id="adjust-qty" type="number" min="0" step="any" {...form.register("quantity")} />
              <p className="text-xs text-destructive">{error("quantity")}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="adjust-reason">Motivo</Label>
            <Textarea id="adjust-reason" rows={2} placeholder="Ej.: conteo físico del 18/10, 2 tubos rotos" {...form.register("reason")} />
            <p className="text-xs text-destructive">{error("reason")}</p>
          </div>
          {selected && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p>Stock actual: <b>{formatQuantity(selected.current_stock, selected.unit_of_measure)}</b> · Costo promedio: <b>{formatUnitCost(selected.unit_cost)}</b></p>
              {quantity > 0 && resulting !== null && (
                <p className={resulting < 0 ? "text-destructive" : undefined}>
                  Stock resultante: <b>{formatQuantity(resulting, selected.unit_of_measure)}</b>
                  {resulting < 0 && " — no hay stock suficiente"}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={adjust.isPending || (resulting !== null && resulting < 0)}>
              {adjust.isPending ? "Registrando..." : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
