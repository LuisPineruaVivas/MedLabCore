import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useErpModule } from "@/hooks/useErpModule";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useRegisterPurchase } from "../hooks/useInventory";
import { purchaseSchema, type PurchaseFormValues } from "../schemas/inventorySchemas";
import type { Item } from "../types";
import { formatCurrency, formatUnitCost } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { amountInAccountCurrency } from "../utils/finance";
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
  // Money side: admins pay from an account or leave it pending; bioanalysts always leave it pending.
  const { canManageFinances } = useErpModule();
  const { data: accounts = [] } = useBankAccounts(canManageFinances ? orgId : null, true);
  const { data: liveRate } = useExchangeRate(orgId);
  const [payMode, setPayMode] = useState<"account" | "later">("later");
  const [accountId, setAccountId] = useState("");
  const [rate, setRate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      form.reset(emptyValues(itemId));
      setByPackage(false);
      setPayMode(canManageFinances ? "account" : "later");
      setAccountId("");
      setRate(null);
      setDueDate("");
    }
  }, [open, itemId, form, canManageFinances]);

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
  const purchaseTotal = Math.round(enteredQuantity * enteredCost * 100) / 100;
  const payFromAccount = canManageFinances && payMode === "account" && purchaseTotal > 0;
  const account = accounts.find((item) => item.id === (accountId || accounts[0]?.id));
  const isLocalAccount = !!account && account.currency !== "USD";
  const effectiveRate = rate ?? (liveRate?.rate ? String(liveRate.rate) : "");
  const accountAmount = account ? amountInAccountCurrency("USD", purchaseTotal, account.currency, Number(effectiveRate)) : null;
  const paymentInvalid = payFromAccount && (!account || (isLocalAccount && !(Number(effectiveRate) > 0)));

  function onSubmit(values: PurchaseFormValues) {
    const converted = toStockUnits(values.quantity, values.unit_cost, unitsPerPackage, usePackages);
    if (paymentInvalid) return;
    register.mutate({
      ...values,
      quantity: converted.quantity,
      unit_cost: converted.unitCost,
      account_id: payFromAccount ? account?.id : null,
      exchange_rate: payFromAccount && isLocalAccount ? Number(effectiveRate) : null,
      due_date: payFromAccount ? null : dueDate || null,
    }, {
      onSuccess: (result) => {
        const money = result?.payable_id ? " Quedó en cuentas por pagar." : result?.movement_id ? ` Pagada desde ${account?.name}.` : "";
        toast.success(`Compra registrada. Stock: ${formatQuantity(result?.new_stock, selected?.unit_of_measure)}.${money}`);
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
          {purchaseTotal > 0 && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Pago de la compra ({formatCurrency(purchaseTotal)})</p>
              {canManageFinances ? (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pago de la compra">
                  <Button type="button" size="sm" role="radio" aria-checked={payMode === "account"} variant={payMode === "account" ? "default" : "outline"} onClick={() => setPayMode("account")}>Pagada desde una cuenta</Button>
                  <Button type="button" size="sm" role="radio" aria-checked={payMode === "later"} variant={payMode === "later" ? "default" : "outline"} onClick={() => setPayMode("later")}>Queda por pagar</Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">La compra quedará en cuentas por pagar para que el administrador la pague.</p>
              )}
              {payFromAccount ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Cuenta</Label>
                    <Select value={account?.id ?? ""} onValueChange={(value) => { setAccountId(value); setRate(null); }}>
                      <SelectTrigger aria-label="Cuenta de pago"><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
                      <SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {isLocalAccount && (
                    <div className="space-y-1">
                      <Label htmlFor="purchase-rate">Tasa ({account.currency}/USD)</Label>
                      <Input id="purchase-rate" type="number" min="0.0001" step="0.0001" value={effectiveRate} onChange={(event) => setRate(event.target.value)} />
                    </div>
                  )}
                  {account && accountAmount !== null && (
                    <p className="col-span-2 text-xs text-muted-foreground">Sale de {account.name}: <b>{formatCurrency(accountAmount, account.currency)}</b></p>
                  )}
                  {!accounts.length && <p className="col-span-2 text-xs text-destructive">No hay cuentas activas.</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="purchase-due">Fecha límite de pago (opcional)</Label>
                  <Input id="purchase-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={register.isPending || paymentInvalid}>{register.isPending ? "Registrando..." : "Registrar compra"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
