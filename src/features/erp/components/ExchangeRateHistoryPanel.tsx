import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatExchangeRate } from "../utils/currencyFormatters";
import { useExchangeRateHistory, useSaveExchangeRate } from "../hooks/useExchangeRateHistory";

export function ExchangeRateHistoryPanel({ orgId, userId, canManage }: { orgId: string | null; userId: string | null; canManage: boolean }) {
  const { data: rates = [], isLoading } = useExchangeRateHistory(orgId);
  const save = useSaveExchangeRate(orgId);
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const submit = () => { if (userId) save.mutate({ rate: Number(rate), effectiveDate: date },{ onSuccess: () => setRate("") }); };
  return <section className="rounded-xl border bg-card p-5 space-y-4">
    <div><h2 className="font-semibold">Historial de tasas</h2><p className="text-sm text-muted-foreground">La factura conserva la tasa aplicada al momento de su emisión.</p></div>
    {canManage && <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-2 items-end"><div><Label>Tasa USD → VES</Label><Input type="number" min="0" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} /></div><div><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><Button onClick={submit} disabled={!rate || save.isPending}>{save.isPending ? "Guardando..." : "Guardar tasa"}</Button></div>}
    <div className="max-h-64 overflow-auto divide-y">{isLoading ? <p className="py-4 text-sm text-muted-foreground">Cargando tasas...</p> : rates.length ? rates.map((entry) => <div className="flex justify-between py-2 text-sm" key={entry.id}><span>{entry.effective_date}</span><span className="font-medium">Bs. {formatExchangeRate(entry.rate)}</span></div>) : <p className="py-4 text-sm text-muted-foreground">Aún no hay tasas históricas.</p>}</div>
  </section>;
}
