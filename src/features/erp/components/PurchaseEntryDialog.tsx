import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegisterPurchase } from "../hooks/useInventory";
import { purchaseSchema, type PurchaseFormValues } from "../schemas/inventorySchemas";
import type { Item } from "../types";
import { formatCurrency, formatUnitCost } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { computeWac, formatQuantity, toStockUnits, UNIT_LABELS } from "../utils/inventory";

interface PurchaseEntryDialogProps {
  orgId: string | null;
  items: Item[];
  /** Pre-selects an item (e.g. when opened from its Kardex). */
  itemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyValues = (itemId?: string | null): PurchaseFormValues => ({
  item_id: itemId ?? "",
  quantity: 0,
  unit_cost: 0,
  supplier_name: "",
  purchase_invoice_ref: "",
  lot_number: "",
  expiration_date: "",
  notes: "",
});

export function PurchaseEntryDialog({ orgId, items, itemId, open, onOpenChange }: PurchaseEntryDialogProps) {
  const register = useRegisterPurchase(orgId);
  const form = useForm<PurchaseFormValues>({ resolver: zodResolver(purchaseSchema), defaultValues: emptyValues(itemId) });

  const [byPackage, setByPackage] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(emptyValues(itemId));
      setByPackage(false);
    }
  }, [open, itemId, form]);

  const activeItems = items.filter((item) => item.is_active);
  const selected = items.find((item) => item.id === form.watch("item_id"));
  const unitsPerPackage = Number(selected?.units_per_package ?? 1);
  const canBuyByPackage = unitsPerPackage > 1;
  const usePackages = canBuyByPackage && byPackage;
  const enteredQuantity = Number(form.watch("quantity")) || 0;
  const enteredCost = Number(form.watch("unit_cost")) || 0;
  // What actually reaches stock: always in the item's unit of measure.
  const { quantity, unitCost } = toStockUnits(enteredQuantity, enteredCost, unitsPerPackage, usePackages);
  const unitLabel = selected ? UNIT_LABELS[selected.unit_of_measure] : "";
  const previewWac = selected && quantity > 0 ? computeWac(Number(selected.current_stock), Number(selected.unit_cost), quantity, unitCost) : null;
  const error = (name: keyof PurchaseFormValues) => form.formState.errors[name]?.message;

  function onSubmit(values: PurchaseFormValues) {
    const converted = toStockUnits(values.quantity, values.unit_cost, unitsPerPackage, usePackages);
    register.mutate({ ...values, quantity: converted.quantity, unit_cost: converted.unitCost }, {
      onSuccess: (result) => {
        toast.success(`Compra registrada. Stock: ${formatQuantity(result?.new_stock, selected?.unit_of_measure)}.`);
        onOpenChange(false);
      },
      onError: (mutationError) => toast.error(getErpErrorMessage(mutationError)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Registrar compra</DialogTitle>
          <DialogDescription>La entrada aumenta el stock y recalcula el costo promedio ponderado.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label>Insumo</Label>
            <Select value={form.watch("item_id")} onValueChange={(value) => form.setValue("item_id", value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un insumo" /></SelectTrigger>
              <SelectContent>
                {activeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-destructive">{error("item_id")}</p>
          </div>
          {canBuyByPackage && (
            <div className="space-y-1">
              <Label>Registrar compra por</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Registrar compra por">
                <Button type="button" size="sm" role="radio" aria-checked={!usePackages} variant={usePackages ? "outline" : "default"} onClick={() => setByPackage(false)}>
                  {unitLabel}
                </Button>
                <Button type="button" size="sm" role="radio" aria-checked={usePackages} variant={usePackages ? "default" : "outline"} onClick={() => setByPackage(true)}>
                  Empaques de {formatQuantity(unitsPerPackage)} {unitLabel}
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="purchase-qty">Cantidad {usePackages ? "(empaques)" : selected ? `(${unitLabel})` : ""}</Label>
              <Input id="purchase-qty" type="number" min="0" step="any" {...form.register("quantity")} />
              <p className="text-xs text-destructive">{error("quantity")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-cost">{usePackages ? "Costo por empaque USD" : "Costo unitario USD"}</Label>
              <Input id="purchase-cost" type="number" min="0" step="0.0001" {...form.register("unit_cost")} />
              <p className="text-xs text-destructive">{error("unit_cost")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-supplier">Proveedor</Label>
              <Input id="purchase-supplier" {...form.register("supplier_name")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-ref"># Factura proveedor</Label>
              <Input id="purchase-ref" {...form.register("purchase_invoice_ref")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-lot">Lote</Label>
              <Input id="purchase-lot" {...form.register("lot_number")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchase-exp">Vencimiento</Label>
              <Input id="purchase-exp" type="date" {...form.register("expiration_date")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchase-notes">Notas</Label>
            <Input id="purchase-notes" {...form.register("notes")} />
          </div>
          {selected && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p>Stock actual: <b>{formatQuantity(selected.current_stock, selected.unit_of_measure)}</b> · Costo promedio: <b>{formatUnitCost(selected.unit_cost)}</b></p>
              {usePackages && enteredQuantity > 0 && (
                <p>
                  {formatQuantity(enteredQuantity)} empaques × {formatQuantity(unitsPerPackage)} = <b>{formatQuantity(quantity, selected.unit_of_measure)}</b> · Costo por {unitLabel}: <b>{formatUnitCost(unitCost)}</b>
                </p>
              )}
              {previewWac !== null && (
                <p>
                  Después de la compra: <b>{formatQuantity(Number(selected.current_stock) + quantity, selected.unit_of_measure)}</b> · Nuevo costo promedio: <b>{formatUnitCost(previewWac)}</b>
                  {" "}· Total compra: <b>{formatCurrency(enteredQuantity * enteredCost)}</b>
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={register.isPending}>{register.isPending ? "Registrando..." : "Registrar compra"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
