import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCloseCash } from "../hooks/useCashRegister";
import type { CashSession, CashSessionTotals } from "../types";
import { buildCashReconciliation, describeDifference, hasCashDifferences, parseCountInput, sortCurrencies } from "../utils/cashRegister";
import { formatCurrency } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";

interface CloseCashDialogProps {
  orgId: string | null;
  session: CashSession;
  totals: CashSessionTotals;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
}

export function CloseCashDialog({ orgId, session, totals, open, onOpenChange, onClosed }: CloseCashDialogProps) {
  const closeCash = useCloseCash(orgId);
  const currencies = useMemo(() => sortCurrencies(Object.keys(totals).length ? Object.keys(totals) : ["USD", "VES"]), [totals]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const counted = Object.fromEntries(currencies.map((currency) => [currency, parseCountInput(inputs[currency] ?? "")]));
  const rows = buildCashReconciliation(totals, counted);
  const missingCount = rows.some((row) => row.counted === null);
  const withDifferences = hasCashDifferences(rows);
  const needsNotes = withDifferences && !notes.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (missingCount || needsNotes) return;
    closeCash.mutate(
      { sessionId: session.id, counted: Object.fromEntries(rows.map((row) => [row.currency, row.counted ?? 0])), notes },
      {
        onSuccess: () => {
          toast.success(withDifferences ? "Caja cerrada con diferencias registradas." : "Caja cerrada y cuadrada.");
          setInputs({});
          setNotes("");
          onOpenChange(false);
          onClosed?.();
        },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Cuenta el efectivo físico por moneda. El sistema lo compara con el fondo inicial más los cobros en efectivo.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.currency} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-semibold">{row.currency}</p>
                    <p className="text-muted-foreground">
                      Fondo {formatCurrency(row.opening, row.currency)} + efectivo {formatCurrency(row.cashPayments, row.currency)}
                    </p>
                    <p>Esperado: <b>{formatCurrency(row.cashExpected, row.currency)}</b></p>
                    {row.electronic > 0 && (
                      <p className="text-xs text-muted-foreground">Electrónicos (no se cuentan): {formatCurrency(row.electronic, row.currency)}</p>
                    )}
                  </div>
                  <div className="w-40 space-y-1">
                    <Label htmlFor={`count-${row.currency}`}>Contado {row.currency}</Label>
                    <Input
                      id={`count-${row.currency}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={inputs[row.currency] ?? ""}
                      onChange={(event) => setInputs((current) => ({ ...current, [row.currency]: event.target.value }))}
                    />
                  </div>
                </div>
                {row.difference !== null && (
                  <p
                    className={cn(
                      "mt-2 text-sm font-medium",
                      Math.abs(row.difference) < 0.01 ? "text-emerald-600" : row.difference > 0 ? "text-amber-600" : "text-destructive"
                    )}
                  >
                    {describeDifference(row.difference)}
                    {Math.abs(row.difference) >= 0.01 && `: ${formatCurrency(row.difference, row.currency)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="closing-notes">Notas de cierre{withDifferences ? " (obligatorias si hay diferencias)" : ""}</Label>
            <Textarea id="closing-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explica sobrantes o faltantes..." />
          </div>
          <p className="text-xs text-muted-foreground">Operador: {session.operator_name}. Al cerrar, los pagos de esta sesión ya no podrán anularse.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={missingCount || needsNotes || closeCash.isPending}>
              {closeCash.isPending ? "Cerrando..." : "Cerrar y conciliar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
