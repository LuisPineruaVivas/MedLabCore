import { useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import { Calculator, CheckCircle2, FileDown, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { buildLabData } from "@/features/orders/OrderDetailSections";
import { CloseCashDialog } from "@/features/erp/components/CloseCashDialog";
import { OpenCashDialog } from "@/features/erp/components/OpenCashDialog";
import { useCashSessions, useCashSessionSummary, useOpenCashSession, useReviewCash } from "@/features/erp/hooks/useCashRegister";
import type { CashSession, CashSessionTotals } from "@/features/erp/types";
import { buildCashReconciliation, describeDifference, PAYMENT_METHOD_LABELS, sortCurrencies } from "@/features/erp/utils/cashRegister";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { CashRegisterReportPDF } from "@/lib/cashRegisterReportPDF";

const STATUS_BADGES: Record<CashSession["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  open: { label: "Abierta", variant: "outline" },
  closed: { label: "Cerrada", variant: "secondary" },
  reviewed: { label: "Revisada", variant: "default" },
};

const HISTORY_PAGE = 20;

const formatDateTime = (value: string | null) => (value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "—");

function DifferenceSummary({ session }: { session: CashSession }) {
  const entries = sortCurrencies(Object.keys(session.difference ?? {})).map((currency) => [currency, session.difference![currency]] as const);
  if (!entries.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {entries.map(([currency, value]) => (
        <p key={currency} className={Math.abs(value.difference) < 0.01 ? "text-emerald-600" : "text-destructive"}>
          {currency}: {Math.abs(value.difference) < 0.01 ? "Cuadrada" : `${describeDifference(value.difference)} ${formatCurrency(value.difference, currency)}`}
        </p>
      ))}
    </div>
  );
}

export default function CashRegisterPage() {
  const { orgId, organization } = useCurrentOrgContext();
  const { canManageCashRegister, canManageFinances } = useErpModule();
  const { data: session, isLoading } = useOpenCashSession(orgId);
  const { data: liveTotals = {} } = useCashSessionSummary(session?.id);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const { data: history = [], isLoading: loadingHistory, isFetching: fetchingHistory } = useCashSessions(orgId, historyLimit);
  const review = useReviewCash(orgId);
  const labData = useMemo(() => buildLabData(organization), [organization]);

  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [reviewing, setReviewing] = useState<CashSession | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);

  const liveRows = buildCashReconciliation(liveTotals);
  const methods = sortCurrencies(Object.keys(liveTotals)).flatMap((currency) =>
    (liveTotals[currency]?.by_method ?? []).map((method) => ({ ...method, currency }))
  );

  async function openReport(target: CashSession, totals: CashSessionTotals) {
    setPrintingId(target.id);
    try {
      const blob = await pdf(<CashRegisterReportPDF session={target} totals={totals} labData={labData} />).toBlob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (error) {
      console.error("Error generando el reporte de caja:", error);
      toast.error("No se pudo generar el PDF de cierre.");
    } finally {
      setPrintingId(null);
    }
  }

  function handleReview() {
    if (!reviewing) return;
    review.mutate(
      { sessionId: reviewing.id, notes: reviewNotes },
      {
        onSuccess: () => {
          toast.success("Cierre marcado como revisado.");
          setReviewing(null);
          setReviewNotes("");
        },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      }
    );
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando caja...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Caja"
        description={session ? `Caja abierta por ${session.operator_name} desde ${formatDateTime(session.opened_at)}` : "Abre una caja para asociar y conciliar los cobros del turno."}
        actions={
          canManageCashRegister &&
          (session ? (
            <>
              <Button variant="outline" onClick={() => openReport(session, liveTotals)} disabled={printingId === session.id}>
                <FileDown className="mr-2 h-4 w-4" />Corte parcial
              </Button>
              <Button onClick={() => setDialog("close")}><Lock className="mr-2 h-4 w-4" />Cerrar caja</Button>
            </>
          ) : (
            <Button onClick={() => setDialog("open")}><Unlock className="mr-2 h-4 w-4" />Abrir caja</Button>
          ))
        }
      />

      {session ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {liveRows.map((row) => (
              <article key={row.currency} className="rounded-xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">Efectivo esperado {row.currency}</p>
                <p className="text-2xl font-bold">{formatCurrency(row.cashExpected, row.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fondo {formatCurrency(row.opening, row.currency)} · Cobros en efectivo {formatCurrency(row.cashPayments, row.currency)}
                </p>
                {row.electronic > 0 && (
                  <p className="text-xs text-muted-foreground">Medios electrónicos: {formatCurrency(row.electronic, row.currency)}</p>
                )}
              </article>
            ))}
          </div>
          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-3"><h2 className="font-semibold">Cobros de la sesión</h2></div>
            {methods.length ? (
              <div className="divide-y">
                {methods.map((method) => (
                  <div key={`${method.currency}-${method.name}`} className="flex items-center justify-between px-5 py-2 text-sm">
                    <span>{method.name} <span className="text-muted-foreground">· {PAYMENT_METHOD_LABELS[method.method_type] ?? method.method_type} · {method.count} pago(s)</span></span>
                    <span className="font-medium">{formatCurrency(method.total, method.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Aún no hay cobros en esta sesión.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
          <Calculator className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No hay una caja abierta</p>
          <p className="max-w-md text-sm text-muted-foreground">Los cobros registrados sin caja abierta no entran en ningún cierre. Abre la caja al iniciar el turno.</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Historial de cierres</h2>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apertura</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Diferencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow><TableCell colSpan={6}>Cargando historial...</TableCell></TableRow>
              ) : history.length ? (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDateTime(item.opened_at)}</TableCell>
                    <TableCell>{formatDateTime(item.closed_at)}</TableCell>
                    <TableCell>{item.operator_name}</TableCell>
                    <TableCell className="text-sm"><DifferenceSummary session={item} /></TableCell>
                    <TableCell><Badge variant={STATUS_BADGES[item.status].variant}>{STATUS_BADGES[item.status].label}</Badge></TableCell>
                    <TableCell className="space-x-1 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openReport(item, item.expected_totals ?? {})} disabled={printingId === item.id}>
                        <FileDown className="mr-1 h-4 w-4" />PDF
                      </Button>
                      {canManageFinances && item.status === "closed" && (
                        <Button size="sm" variant="outline" onClick={() => setReviewing(item)}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />Revisar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Todavía no hay cierres de caja.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {history.length >= historyLimit && (
          <Button variant="outline" size="sm" onClick={() => setHistoryLimit((value) => value + HISTORY_PAGE)} disabled={fetchingHistory}>
            {fetchingHistory ? "Cargando..." : "Ver cierres anteriores"}
          </Button>
        )}
      </section>

      <OpenCashDialog orgId={orgId} open={dialog === "open"} onOpenChange={(open) => setDialog(open ? "open" : null)} />
      {session && (
        <CloseCashDialog
          orgId={orgId}
          session={session}
          totals={liveTotals}
          open={dialog === "close"}
          onOpenChange={(open) => setDialog(open ? "close" : null)}
        />
      )}

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar cierre de caja</DialogTitle>
            <DialogDescription>
              {reviewing && `Caja de ${reviewing.operator_name}, cerrada el ${formatDateTime(reviewing.closed_at)}.`}
            </DialogDescription>
          </DialogHeader>
          {reviewing && <div className="text-sm"><DifferenceSummary session={reviewing} /></div>}
          {reviewing?.closing_notes && <p className="text-sm text-muted-foreground">Notas del operador: {reviewing.closing_notes}</p>}
          <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Observaciones de la revisión (opcional)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancelar</Button>
            <Button onClick={handleReview} disabled={review.isPending}>{review.isPending ? "Guardando..." : "Marcar como revisada"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
