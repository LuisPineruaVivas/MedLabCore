import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useCreateFinanceCategory, useCreateMovement, useFinanceCategories, type MovementInput } from "../hooks/useFinance";
import { formatCurrency } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { toUsd, todayIso } from "../utils/finance";

export type MovementDialogKind = "income" | "expense" | "adjustment";

const TITLES: Record<MovementDialogKind, string> = { expense: "Registrar gasto", income: "Registrar ingreso", adjustment: "Ajustar saldo" };
const NEW_CATEGORY = "__new__";

interface MovementDialogProps {
  kind: MovementDialogKind | null;
  defaultAccountId?: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Other income, expenses and balance adjustments. Mounted per open, so each form starts clean. */
export function MovementDialog({ kind, defaultAccountId, onOpenChange }: MovementDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{kind ? TITLES[kind] : ""}</DialogTitle></DialogHeader>
        {kind && <MovementForm kind={kind} defaultAccountId={defaultAccountId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MovementForm({ kind, defaultAccountId, onDone }: { kind: MovementDialogKind; defaultAccountId?: string | null; onDone: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances } = useErpModule();
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const { data: categories = [] } = useFinanceCategories(orgId);
  const { data: liveRate } = useExchangeRate(orgId);
  const create = useCreateMovement(orgId);
  const createCategory = useCreateFinanceCategory(orgId);

  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [direction, setDirection] = useState<"adjustment_in" | "adjustment_out">("adjustment_out");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [date, setDate] = useState(todayIso());
  const [rate, setRate] = useState<string | null>(null); // null = use the live rate
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  const account = accounts.find((item) => item.id === (accountId || accounts[0]?.id));
  const isLocal = !!account && account.currency !== "USD";
  const effectiveRate = rate ?? (liveRate?.rate ? String(liveRate.rate) : "");
  const numericAmount = Number(amount);
  const usd = account ? toUsd(account.currency, numericAmount, Number(effectiveRate)) : null;
  const needsCategory = kind !== "adjustment";
  const kindCategories = categories.filter((item) => item.kind === kind);

  const invalid =
    !account || !(numericAmount > 0) || !date ||
    (isLocal && !(Number(effectiveRate) > 0)) ||
    (needsCategory && !categoryId) ||
    (categoryId === NEW_CATEGORY && newCategory.trim().length < 2) ||
    (kind === "adjustment" && !description.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || !account) return;
    try {
      const resolvedCategory = categoryId === NEW_CATEGORY
        ? await createCategory.mutateAsync({ name: newCategory, kind: kind as "income" | "expense" })
        : categoryId || null;
      const input: MovementInput = {
        accountId: account.id,
        kind: kind === "adjustment" ? direction : kind,
        amount: numericAmount,
        categoryId: needsCategory ? resolvedCategory : null,
        description,
        date,
        exchangeRate: isLocal ? Number(effectiveRate) : null,
        reference,
      };
      await create.mutateAsync(input);
      toast.success(kind === "expense" ? "Gasto registrado." : kind === "income" ? "Ingreso registrado." : "Ajuste registrado.");
      onDone();
    } catch (error) {
      toast.error(getErpErrorMessage(error, "No se pudo registrar el movimiento."));
    }
  }

  const pending = create.isPending || createCategory.isPending;

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>{kind === "expense" ? "Pagar desde la cuenta" : "Cuenta"}</Label>
          <Select value={account?.id ?? ""} onValueChange={(value) => { setAccountId(value); setRate(null); }}>
            <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
            <SelectContent>
              {accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>)}
            </SelectContent>
          </Select>
          {!accounts.length && <p className="text-xs text-destructive">No hay cuentas activas. Un administrador debe crearlas.</p>}
        </div>

        {kind === "adjustment" && (
          <div className="space-y-1 sm:col-span-2">
            <Label>Tipo de ajuste</Label>
            <Select value={direction} onValueChange={(value) => setDirection(value as typeof direction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment_out">Salida (falta dinero en la cuenta)</SelectItem>
                <SelectItem value="adjustment_in">Entrada (sobra dinero en la cuenta)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {needsCategory && (
          <div className="space-y-1 sm:col-span-2">
            <Label>{kind === "expense" ? "¿Qué se está pagando?" : "Concepto"}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
              <SelectContent>
                {kindCategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                {canManageFinances && <SelectItem value={NEW_CATEGORY}>+ Nueva categoría…</SelectItem>}
              </SelectContent>
            </Select>
            {categoryId === NEW_CATEGORY && (
              <Input autoFocus placeholder="Nombre de la categoría" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label>Monto {account ? `(${account.currency})` : ""}</Label>
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={date} max={todayIso()} min={account?.opening_date} onChange={(event) => setDate(event.target.value)} />
        </div>
        {isLocal && (
          <div className="space-y-1 sm:col-span-2">
            <Label>Tasa ({account.currency}/USD)</Label>
            <Input type="number" min="0.0001" step="0.0001" value={effectiveRate} onChange={(event) => setRate(event.target.value)} />
            {usd !== null && numericAmount > 0 && <p className="text-xs text-muted-foreground">Equivale a {formatCurrency(usd)}</p>}
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label>{kind === "adjustment" ? "Motivo (obligatorio)" : "Descripción"}</Label>
          <Input
            value={description}
            placeholder={kind === "expense" ? "Ej.: factura de luz de noviembre" : undefined}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Referencia</Label>
          <Input value={reference} placeholder="N.º de transferencia, factura, recibo…" onChange={(event) => setReference(event.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending || invalid}>{pending ? "Guardando..." : TITLES[kind]}</Button>
    </form>
  );
}
