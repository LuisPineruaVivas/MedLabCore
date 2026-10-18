import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOpenCash } from "../hooks/useCashRegister";
import { parseCountInput } from "../utils/cashRegister";
import { getErpErrorMessage } from "../utils/erpErrors";

interface OpenCashDialogProps {
  orgId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenCashDialog({ orgId, open, onOpenChange }: OpenCashDialogProps) {
  const openCash = useOpenCash(orgId);
  const [usd, setUsd] = useState("");
  const [ves, setVes] = useState("");
  const [notes, setNotes] = useState("");

  const usdValue = usd.trim() ? parseCountInput(usd) : 0;
  const vesValue = ves.trim() ? parseCountInput(ves) : 0;
  const invalid = usdValue === null || vesValue === null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid) return;
    openCash.mutate(
      { usd: usdValue, ves: vesValue, notes },
      {
        onSuccess: () => {
          toast.success("Caja abierta. Los cobros se asociarán a esta sesión.");
          setUsd("");
          setVes("");
          setNotes("");
          onOpenChange(false);
        },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>Registra el fondo de efectivo con el que inicia el turno.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="opening-usd">Fondo inicial USD</Label>
              <Input id="opening-usd" inputMode="decimal" placeholder="0,00" value={usd} onChange={(event) => setUsd(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opening-ves">Fondo inicial VES</Label>
              <Input id="opening-ves" inputMode="decimal" placeholder="0,00" value={ves} onChange={(event) => setVes(event.target.value)} />
            </div>
          </div>
          {invalid && <p className="text-xs text-destructive">Los montos deben ser números positivos.</p>}
          <div className="space-y-1">
            <Label htmlFor="opening-notes">Notas</Label>
            <Textarea id="opening-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Turno, observaciones del fondo..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={invalid || openCash.isPending}>{openCash.isPending ? "Abriendo..." : "Abrir caja"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
