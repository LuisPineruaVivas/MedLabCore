import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useCreateTransfer } from "../hooks/useFinance";
import { formatExchangeRate } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { todayIso, transferRate } from "../utils/finance";

/** Moves money between two accounts. With different currencies the user enters what left and what arrived. */
export function TransferDialog({ open, defaultFromId, onOpenChange }: { open: boolean; defaultFromId?: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Transferir entre cuentas</DialogTitle></DialogHeader>
        {open && <TransferForm defaultFromId={defaultFromId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({ defaultFromId, onDone }: { defaultFromId?: string | null; onDone: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const transfer = useCreateTransfer(orgId);
  const [fromId, setFromId] = useState(defaultFromId ?? "");
  const [toId, setToId] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  const from = accounts.find((item) => item.id === fromId);
  const to = accounts.find((item) => item.id === toId);
  const sameCurrency = !!from && !!to && from.currency === to.currency;
  const unsupported = !!from && !!to && !sameCurrency && from.currency !== "USD" && to.currency !== "USD";
  const rate = from && to ? transferRate(from.currency, Number(fromAmount), to.currency, Number(toAmount)) : null;
  const localCurrency = from && to ? (from.currency === "USD" ? to.currency : from.currency) : "";

  const invalid = !from || !to || from.id === to.id || unsupported || !(Number(fromAmount) > 0) || (!sameCurrency && !(Number(toAmount) > 0)) || !date;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || !from || !to) return;
    transfer.mutate(
      { fromAccountId: from.id, fromAmount: Number(fromAmount), toAccountId: to.id, toAmount: sameCurrency ? null : Number(toAmount), date, description, reference },
      {
        onSuccess: () => { toast.success("Transferencia registrada."); onDone(); },
        onError: (error) => toast.error(getErpErrorMessage(error, "No se pudo registrar la transferencia.")),
      },
    );
  }

  const accountOptions = (excludeId?: string) =>
    accounts.filter((item) => item.id !== excludeId).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>);

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>Sale de</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger><SelectValue placeholder="Cuenta de origen" /></SelectTrigger>
            <SelectContent>{accountOptions(toId)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Monto que sale {from ? `(${from.currency})` : ""}</Label>
          <Input type="number" min="0.01" step="0.01" value={fromAmount} onChange={(event) => setFromAmount(event.target.value)} />
        </div>
      </div>
      <ArrowDown className="mx-auto h-5 w-5 text-muted-foreground" />
      <div className="space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>Llega a</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger><SelectValue placeholder="Cuenta de destino" /></SelectTrigger>
            <SelectContent>{accountOptions(fromId)}</SelectContent>
          </Select>
        </div>
        {to && !sameCurrency && (
          <div className="space-y-1">
            <Label>Monto que llega ({to.currency})</Label>
            <Input type="number" min="0.01" step="0.01" value={toAmount} onChange={(event) => setToAmount(event.target.value)} />
          </div>
        )}
      </div>
      {unsupported && <p className="text-xs text-destructive">Entre dos monedas distintas, una de las cuentas debe ser en USD.</p>}
      {rate !== null && <p className="text-sm text-muted-foreground">Tasa del cambio: <b>{formatExchangeRate(rate)} {localCurrency}/USD</b></p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Referencia</Label>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Nota</Label>
          <Input value={description} placeholder="Ej.: cambio de divisas, depósito de efectivo" onChange={(event) => setDescription(event.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={transfer.isPending || invalid}>{transfer.isPending ? "Guardando..." : "Transferir"}</Button>
    </form>
  );
}
