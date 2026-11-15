import { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, endOfMonth, format } from "date-fns";
import { ChevronLeft, ChevronRight, HandCoins, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { InvoiceStatusBadge } from "@/features/erp/components/InvoiceStatusBadge";
import { OrderPaymentDialog } from "@/features/erp/components/OrderPaymentDialog";
import { useInstallments, useOpenBalances, useReceivablesOverview, type InstallmentWindow } from "@/features/erp/hooks/useReceivables";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { todayIso } from "@/features/erp/utils/finance";
import { formatShortDate } from "@/features/erp/utils/reports";
import type { ReceivableInvoiceRef } from "@/features/erp/types";

const PAGE_SIZE = 50;
type Tab = "installments" | "balances";
const WINDOW_LABELS: Record<InstallmentWindow, string> = { upcoming: "Todas", overdue: "Vencidas", week: "Próximos 7 días", month: "Este mes" };

interface Collecting { invoiceId: string; suggestedUsd: number | null; title: string }

const patientName = (invoice: ReceivableInvoiceRef) => (invoice.patients ? `${invoice.patients.first_name} ${invoice.patients.last_name}` : "—");

function PatientCell({ invoice }: { invoice: ReceivableInvoiceRef }) {
  return (
    <TableCell>
      <div className="font-medium">{patientName(invoice)}</div>
      <div className="text-xs text-muted-foreground">
        {[invoice.patients?.id_number, invoice.patients?.phone].filter(Boolean).join(" · ")}
        {" · "}
        <Link className="text-primary hover:underline" to={`/orders/${invoice.order_id}`}>Orden #{invoice.orders?.order_seq ?? "—"}</Link>
        {" · "}
        <Link className="text-primary hover:underline" to={`/erp/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
      </div>
    </TableCell>
  );
}

function Pager({ page, total, busy, onPage }: { page: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("es-VE")}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onPage(Math.max(page - 1, 1))} disabled={page <= 1 || busy} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <span>Página {page} de {pageCount}</span>
        <Button variant="outline" size="icon" onClick={() => onPage(Math.min(page + 1, pageCount))} disabled={page >= pageCount || busy} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export default function ReceivablesPage() {
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances: isAdmin } = useErpModule();
  const [tab, setTab] = useState<Tab>("balances");
  const [window, setWindow] = useState<InstallmentWindow>("upcoming");
  const [installmentsPage, setInstallmentsPage] = useState(1);
  const [balancesPage, setBalancesPage] = useState(1);
  const [collecting, setCollecting] = useState<Collecting | null>(null);

  const today = todayIso();
  const weekEnd = format(addDays(new Date(`${today}T12:00:00`), 7), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(`${today}T12:00:00`)), "yyyy-MM-dd");
  const { data: overview } = useReceivablesOverview(orgId);
  const installments = useInstallments(orgId, window, today, weekEnd, monthEnd, installmentsPage, PAGE_SIZE);
  const balances = useOpenBalances(orgId, balancesPage, PAGE_SIZE);

  const cards: { label: string; value?: number; count?: number; tone?: string; onClick?: () => void }[] = [
    { label: "Total por cobrar", value: overview?.total_usd, count: overview?.open_invoices, onClick: () => setTab("balances") },
    { label: "Cuotas vencidas", value: overview?.overdue_usd, count: overview?.overdue_count, tone: Number(overview?.overdue_usd) > 0 ? "text-destructive" : "", onClick: () => { setTab("installments"); setWindow("overdue"); setInstallmentsPage(1); } },
    { label: "Cuotas próximos 7 días", value: overview?.due_week_usd, count: overview?.due_week_count, onClick: () => { setTab("installments"); setWindow("week"); setInstallmentsPage(1); } },
    { label: "Saldos sin plan de cuotas", value: overview?.unscheduled_usd, count: overview?.unscheduled_count, onClick: () => setTab("balances") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Por cobrar" description="Todas las órdenes que los pacientes aún deben, pagadas en cuotas o no. Cobra directamente desde aquí." />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            disabled={!card.onClick}
            onClick={card.onClick}
            className="rounded-xl border bg-card p-4 text-left transition-colors enabled:hover:bg-muted/50"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.tone ?? ""}`}>{formatCurrency(card.value ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{card.count ?? 0} {card.label.startsWith("Cuotas") ? "cuota(s)" : "orden(es)"}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist">
        <Button role="tab" aria-selected={tab === "balances"} variant={tab === "balances" ? "default" : "outline"} onClick={() => setTab("balances")}>Órdenes con saldo</Button>
        <Button role="tab" aria-selected={tab === "installments"} variant={tab === "installments" ? "default" : "outline"} onClick={() => setTab("installments")}>Cuotas</Button>
        {isAdmin && <Button asChild variant="ghost"><Link to="/erp/reports">Antigüedad de saldos (Reportes)</Link></Button>}
      </div>

      {tab === "installments" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(WINDOW_LABELS) as InstallmentWindow[]).map((key) => (
              <Button key={key} size="sm" variant={window === key ? "secondary" : "ghost"} onClick={() => { setWindow(key); setInstallmentsPage(1); }}>{WINDOW_LABELS[key]}</Button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vence</TableHead>
                  <TableHead>Paciente / orden</TableHead>
                  <TableHead>Cuota</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.isLoading ? (
                  <TableRow><TableCell colSpan={5}>Cargando cuotas...</TableCell></TableRow>
                ) : installments.data?.items.length ? (
                  installments.data.items.map((row) => {
                    const remaining = Math.round((Number(row.amount_due_usd) - Number(row.amount_paid_usd)) * 100) / 100;
                    const overdue = row.due_date < today;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className={`whitespace-nowrap ${overdue ? "font-medium text-destructive" : ""}`}>
                          {formatShortDate(row.due_date)}
                          {overdue && <Badge variant="destructive" className="ml-2">Vencida</Badge>}
                        </TableCell>
                        <PatientCell invoice={row.invoices} />
                        <TableCell className="whitespace-nowrap">
                          N.º {row.installment_number} · {formatCurrency(row.amount_due_usd)}
                          {Number(row.amount_paid_usd) > 0 && <div className="text-xs text-muted-foreground">Abonado {formatCurrency(row.amount_paid_usd)}</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(remaining)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setCollecting({ invoiceId: row.invoice_id, suggestedUsd: Math.min(remaining, Number(row.invoices.balance_due_usd)), title: `Cobrar cuota ${row.installment_number} · ${patientName(row.invoices)}` })}>
                            <Wallet className="mr-1 h-4 w-4" />Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <HandCoins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No hay cuotas en este filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pager page={installmentsPage} total={installments.data?.total ?? 0} busy={installments.isFetching} onPage={setInstallmentsPage} />
        </>
      )}

      {tab === "balances" && (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emitida</TableHead>
                  <TableHead>Paciente / orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.isLoading ? (
                  <TableRow><TableCell colSpan={6}>Cargando saldos...</TableCell></TableRow>
                ) : balances.data?.items.length ? (
                  balances.data.items.map((row) => {
                    const plan = row.payment_schedules.filter((item) => item.status !== "cancelled").length;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{formatShortDate(row.issued_at.slice(0, 10))}</TableCell>
                        <PatientCell invoice={row} />
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <InvoiceStatusBadge status={row.status} />
                            {plan > 0 ? <Badge variant="secondary">{plan} cuota(s)</Badge> : <Badge variant="outline">Sin plan</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCurrency(row.total_usd)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(row.balance_due_usd)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setCollecting({ invoiceId: row.id, suggestedUsd: null, title: `Cobrar · ${patientName(row)}` })}>
                            <Wallet className="mr-1 h-4 w-4" />Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No hay saldos pendientes.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Para financiar un saldo en cuotas, abre la factura y usa "Plan de cuotas".</p>
          <Pager page={balancesPage} total={balances.data?.total ?? 0} busy={balances.isFetching} onPage={setBalancesPage} />
        </>
      )}

      <OrderPaymentDialog
        invoiceId={collecting?.invoiceId ?? null}
        suggestedUsd={collecting?.suggestedUsd}
        title={collecting?.title}
        open={!!collecting}
        onOpenChange={(open) => !open && setCollecting(null)}
      />
    </div>
  );
}
