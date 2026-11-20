import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useFinanceCategories } from "../hooks/useFinance";
import { useCancelPayable, useCreatePayable, usePayPayable } from "../hooks/usePayables";
import type { Payable } from "../types";
import { formatCurrency } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { amountInAccountCurrency, todayIso } from "../utils/finance";

const CURRENCIES = [{ value: "USD", label: "Dólares (USD)" }, { value: "VES", label: "Bolívares (Bs)" }];

/** Registers a bill to pay later. Mounted per open so the form starts clean. */
export function NewPayableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Nueva cuenta por pagar</DialogTitle></DialogHeader>
        {open && <NewPayableForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewPayableForm({ onDone }: { onDone: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const { data: categories = [] } = useFinanceCategories(orgId);
  const create = useCreatePayable(orgId);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const invalid = !categoryId || description.trim().length < 2 || !(Number(amount) > 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid) return;
    create.mutate(
      { categoryId, description, payee, amount: Number(amount), currency, dueDate: dueDate || null, reference },
      {
        onSuccess: () => { toast.success("Cuenta por pagar registrada."); onDone(); },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      },
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-1">
        <Label>¿Qué se debe pagar?</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
          <SelectContent>{categories.filter((item) => item.kind === "expense").map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Input value={description} placeholder="Ej.: alquiler de diciembre" onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>A quién (proveedor, beneficiario)</Label>
        <Input value={payee} onChange={(event) => setPayee(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Monto</Label>
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Fecha límite</Label>
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>N.º de factura / referencia</Label>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={invalid || create.isPending}>{create.isPending ? "Guardando..." : "Registrar"}</Button>
    </form>
  );
}

/** Pays all or part of a bill from an account. */
export function PayPayableDialog({ payable, onClose }: { payable: Payable | null; onClose: () => void }) {
  return (
    <Dialog open={!!payable} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Pagar</DialogTitle>
          {payable && <DialogDescription>{payable.payee ? `${payable.payee} · ` : ""}{payable.description}</DialogDescription>}
        </DialogHeader>
        {payable && <PayForm key={payable.id} payable={payable} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ payable, onDone }: { payable: Payable; onDone: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const { data: liveRate } = useExchangeRate(orgId);
  const pay = usePayPayable(orgId);
  const remaining = Math.round((Number(payable.amount) - Number(payable.amount_paid)) * 100) / 100;
  // Default to an account in the bill's currency.
  const [accountId, setAccountId] = useState(() => accounts.find((item) => item.currency === payable.currency)?.id ?? "");
  const [amount, setAmount] = useState<string | null>(null); // null = pay the full remaining
  const [rate, setRate] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");

  const account = accounts.find((item) => item.id === (accountId || accounts.find((acc) => acc.currency === payable.currency)?.id || accounts[0]?.id));
  // Any bolívar side needs the rate: to convert between currencies or for the USD equivalent.
  const localRate = !!account && (account.currency !== "USD" || payable.currency !== "USD");
  const effectiveRate = rate ?? (liveRate?.rate ? String(liveRate.rate) : "");
  const fullAmount = account ? amountInAccountCurrency(payable.currency, remaining, account.currency, Number(effectiveRate)) : null;
  const effectiveAmount = amount ?? (fullAmount !== null ? String(fullAmount) : "");
  const invalid = !account || !(Number(effectiveAmount) > 0) || (!!localRate && !(Number(effectiveRate) > 0));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || !account) return;
    pay.mutate(
      { payableId: payable.id, accountId: account.id, amount: Number(effectiveAmount), date, exchangeRate: localRate ? Number(effectiveRate) : null, reference },
      {
        onSuccess: () => { toast.success("Pago registrado."); onDone(); },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      },
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-sm">Pendiente: <b>{formatCurrency(remaining, payable.currency)}</b></p>
      <div className="space-y-1">
        <Label>Pagar desde la cuenta</Label>
        <Select value={account?.id ?? ""} onValueChange={(value) => { setAccountId(value); setAmount(null); setRate(null); }}>
          <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
          <SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Monto {account ? `(${account.currency})` : ""}</Label>
          <Input type="number" min="0.01" step="0.01" value={effectiveAmount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        {localRate && (
          <div className="space-y-1">
            <Label>Tasa (Bs/USD)</Label>
            <Input type="number" min="0.0001" step="0.0001" value={effectiveRate} onChange={(event) => { setRate(event.target.value); setAmount(null); }} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Referencia</Label>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={invalid || pay.isPending}>{pay.isPending ? "Registrando..." : "Registrar pago"}</Button>
    </form>
  );
}

/** Cancels a bill that will not be paid (admins). */
export function CancelPayableDialog({ payable, onClose }: { payable: Payable | null; onClose: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const cancel = useCancelPayable(orgId);
  const [reason, setReason] = useState("");
  const close = () => { setReason(""); onClose(); };
  return (
    <Dialog open={!!payable} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular cuenta por pagar</DialogTitle>
          <DialogDescription>Lo ya pagado queda registrado; el resto deja de estar pendiente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <Button
          variant="destructive"
          disabled={!reason.trim() || cancel.isPending}
          onClick={() => payable && cancel.mutate({ id: payable.id, reason }, {
            onSuccess: () => { toast.success("Cuenta por pagar anulada."); close(); },
            onError: (error) => toast.error(getErpErrorMessage(error)),
          })}
        >
          {cancel.isPending ? "Anulando..." : "Anular"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
