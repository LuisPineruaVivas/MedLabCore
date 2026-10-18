import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BankAccount } from "../types";
import type { PaymentInput } from "../hooks/usePayments";
import { formatCurrency } from "../utils/currencyFormatters";

type Draft = PaymentInput & { key: number };

interface PaymentFormProps {
  accounts: BankAccount[];
  balance: number;
  /**
   * Rate (local currency per USD) pre-filled for non-USD payments: the same live rate
   * orders are created with. Without it the server would fall back to the manual
   * rate history, which can be days old and convert bolívares at the wrong value.
   */
  defaultRate?: number | null;
  onSubmit: (values: PaymentInput[]) => void;
  pending: boolean;
}

export function PaymentForm({ accounts, balance, defaultRate, onSubmit, pending }: PaymentFormProps) {
  const rateFor = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    return account && account.currency !== "USD" && defaultRate ? Number(defaultRate) : undefined;
  };
  const newDraft = (key: number): Draft => {
    const accountId = accounts[0]?.id ?? "";
    return { key, amount: 0, bank_account_id: accountId, exchange_rate: rateFor(accountId), reference_number: "" };
  };
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft(1)]);

  // The live rate can arrive after the form opens; fill it where the user left it empty.
  useEffect(() => {
    if (!defaultRate) return;
    setDrafts((items) => items.map((item) => (item.exchange_rate ? item : { ...item, exchange_rate: rateFor(item.bank_account_id) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRate]);

  const update = (key: number, data: Partial<Draft>) => setDrafts((items) => items.map((item) => (item.key === key ? { ...item, ...data } : item)));
  const toUsd = (draft: Draft) => {
    const account = accounts.find((item) => item.id === draft.bank_account_id);
    if (!account) return 0;
    if (account.currency === "USD") return draft.amount;
    return draft.exchange_rate ? draft.amount / Number(draft.exchange_rate) : 0;
  };
  const total = Math.round(drafts.reduce((sum, draft) => sum + toUsd(draft), 0) * 100) / 100;
  const missingRate = drafts.some((draft) => {
    const account = accounts.find((item) => item.id === draft.bank_account_id);
    return account && account.currency !== "USD" && !(Number(draft.exchange_rate) > 0);
  });
  const invalid = !accounts.length || missingRate || drafts.some((item) => !item.bank_account_id || item.amount <= 0) || total > balance + 0.005;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onSubmit(drafts.map(({ key: _key, ...item }) => item));
      }}
    >
      <p className="text-sm">Pendiente: <b>{formatCurrency(balance)}</b></p>
      {drafts.map((draft, index) => {
        const account = accounts.find((item) => item.id === draft.bank_account_id);
        const isLocal = account && account.currency !== "USD";
        return (
          <div key={draft.key} className="space-y-3 rounded-lg border p-3">
            <div className="flex justify-between">
              <b className="text-sm">Pago #{index + 1}</b>
              {drafts.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setDrafts((items) => items.filter((item) => item.key !== draft.key))} aria-label="Quitar pago">
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={draft.bank_account_id} onValueChange={(value) => update(draft.key, { bank_account_id: value, exchange_rate: rateFor(value) })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un método" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Monto {account ? `(${account.currency})` : ""}</Label>
                <Input type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => update(draft.key, { amount: Number(event.target.value) })} />
              </div>
              {isLocal && (
                <div className="space-y-1">
                  <Label>Tasa ({account.currency}/USD)</Label>
                  <Input type="number" min="0.0001" step="0.0001" value={draft.exchange_rate || ""} onChange={(event) => update(draft.key, { exchange_rate: Number(event.target.value) })} />
                </div>
              )}
            </div>
            {isLocal && draft.amount > 0 && Number(draft.exchange_rate) > 0 && (
              <p className="text-xs text-muted-foreground">Equivale a {formatCurrency(toUsd(draft))}</p>
            )}
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input value={draft.reference_number ?? ""} onChange={(event) => update(draft.key, { reference_number: event.target.value })} />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="outline" onClick={() => setDrafts((items) => [...items, newDraft(Date.now())])}>
          <Plus className="mr-1 h-4 w-4" />Otro pago
        </Button>
        <span>Total: <b>{formatCurrency(total)}</b></span>
      </div>
      {total > balance + 0.005 && <p className="text-xs text-destructive">El total supera el saldo pendiente.</p>}
      {missingRate && <p className="text-xs text-destructive">Indica la tasa de cambio de los pagos en moneda local.</p>}
      <Button type="submit" disabled={pending || invalid}>{pending ? "Registrando..." : "Registrar pago"}</Button>
    </form>
  );
}
