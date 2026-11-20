import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { cn } from "@/lib/utils";
import { useAccountBalances, useFinanceDashboard, useFinanceMovements } from "../hooks/useFinance";
import { usePayablesSummary } from "../hooks/usePayables";
import { useInstallments, useReceivablesOverview } from "../hooks/useReceivables";
import { formatCurrency } from "../utils/currencyFormatters";
import { FINANCE_KIND_LABELS, dueLabel, formatMonthLabel, todayIso, withLiveUsd } from "../utils/finance";
import { whatsappNumber } from "@/lib/whatsapp";
import { buildPeriod, formatShortDate, isValidPeriod, type ReportPeriod } from "../utils/reports";
import { HorizontalBars, IncomeExpenseChart, PeriodFilter, ReportCard } from "./ReportCharts";

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", tone === "bad" && "text-destructive", tone === "good" && "text-success")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{children}<ArrowRight className="h-3.5 w-3.5" /></Link>;
}

/** The lab's financial picture for admins: income, expenses, profit, balances, receivables and payables. */
export function FinancePanel({ orgId }: { orgId: string | null }) {
  const [period, setPeriod] = useState<ReportPeriod>(() => buildPeriod("this_month"));
  const valid = isValidPeriod(period);
  const { data: dashboard } = useFinanceDashboard(orgId, period, valid);
  const { data: rawBalances = [] } = useAccountBalances(orgId);
  const { data: liveRate } = useExchangeRate(orgId);
  const { data: receivables } = useReceivablesOverview(orgId);
  const today = todayIso();
  // "upcoming" lists every open installment by due date, so overdue ones come first.
  const { data: nextInstallments } = useInstallments(orgId, "upcoming", today, today, today, 1, 6);
  const { data: payables = [] } = usePayablesSummary(orgId);
  const { data: recent } = useFinanceMovements(orgId, { from: null, to: null, accountId: null, kind: null, page: 1, pageSize: 6 });

  const balances = withLiveUsd(rawBalances, liveRate?.rate).filter((item) => item.is_active);
  const available = balances.reduce((sum, item) => sum + Number(item.balance_usd ?? 0), 0);
  const profit = Number(dashboard?.profit_usd ?? 0);
  const payablesOverdue = payables.filter((row) => Number(row.overdue) > 0);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Finanzas del laboratorio</h2>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Ingresos"
          value={formatCurrency(dashboard?.income_usd)}
          hint={dashboard ? `Órdenes ${formatCurrency(dashboard.order_income_usd)} · otros ${formatCurrency(dashboard.other_income_usd)}` : undefined}
        />
        <Kpi label="Egresos" value={formatCurrency(dashboard?.expenses_usd)} hint="Gastos, compras y cuentas pagadas" />
        <Kpi label="Ganancia" value={formatCurrency(profit)} tone={profit < 0 ? "bad" : profit > 0 ? "good" : undefined} hint="Ingresos − egresos (en USD)" />
        <Kpi label="Disponible en cuentas" value={formatCurrency(available)} hint="Aprox. en USD, tasa del día" />
      </div>

      <ReportCard
        title="Cuotas por cobrar"
        description={
          nextInstallments?.total
            ? `Vencidas y próximas a vencer${Number(receivables?.overdue_count) > 0 ? ` · ${receivables?.overdue_count} vencida(s)` : ""}`
            : undefined
        }
      >
        {nextInstallments?.items.length ? (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {nextInstallments.items.map((row) => {
              const remaining = Math.round((Number(row.amount_due_usd) - Number(row.amount_paid_usd)) * 100) / 100;
              const overdue = row.due_date < today;
              const patient = row.invoices.patients;
              const name = patient ? `${patient.first_name} ${patient.last_name}` : "—";
              const phone = whatsappNumber(patient?.phone);
              const message = `Hola ${patient?.first_name ?? ""}, te recordamos que tu cuota N.º ${row.installment_number} de ${formatCurrency(remaining)} ${overdue ? `venció el ${formatShortDate(row.due_date)}` : row.due_date === today ? "vence hoy" : `vence el ${formatShortDate(row.due_date)}`}. ¡Gracias!`;
              return (
                <li key={row.id} className={cn("flex items-center justify-between gap-2 rounded-lg border p-2", overdue && "border-destructive/40")}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Badge variant={overdue ? "destructive" : row.due_date === today ? "default" : "secondary"} className="px-1.5 py-0 text-[10px]">{dueLabel(row.due_date, today)}</Badge>
                      Cuota {row.installment_number} · <b className="tabular-nums text-foreground">{formatCurrency(remaining)}</b>
                    </span>
                  </span>
                  {phone && (
                    <a
                      href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-md p-2 text-success hover:bg-muted"
                      aria-label={`Recordar por WhatsApp a ${name}`}
                      title="Recordar por WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No hay cuotas pendientes.</p>
        )}
        {(nextInstallments?.total ?? 0) > 0 && (
          <div className="mt-3"><MoreLink to="/erp/receivables">Ver todas ({nextInstallments?.total})</MoreLink></div>
        )}
      </ReportCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Ingresos y egresos" description="Últimos 6 meses, en USD" className="lg:col-span-2">
          <IncomeExpenseChart data={(dashboard?.monthly ?? []).map((row) => ({ ...row, label: formatMonthLabel(row.month) }))} />
        </ReportCard>
        <ReportCard title="Saldos por cuenta">
          <ul className="space-y-2 text-sm">
            {balances.map((item) => (
              <li key={item.account_id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className={cn("shrink-0 font-medium tabular-nums", Number(item.balance) < 0 && "text-destructive")}>{formatCurrency(item.balance, item.currency)}</span>
              </li>
            ))}
            {!balances.length && <li className="text-muted-foreground">No hay cuentas activas.</li>}
          </ul>
          <div className="mt-3"><MoreLink to="/erp/accounts">Cuentas</MoreLink></div>
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Gastos por categoría" description="Período seleccionado">
          <HorizontalBars
            rows={(dashboard?.expenses_by_category ?? []).map((row) => ({ key: row.category, label: row.category, value: Number(row.amount_usd) }))}
            emptyText="Sin gastos en el período."
          />
        </ReportCard>
        <ReportCard title="Por cobrar y por pagar">
          <div className="space-y-3 text-sm">
            <div>
              <p className="flex justify-between"><span>Por cobrar</span><b className="tabular-nums">{formatCurrency(receivables?.total_usd)}</b></p>
              <p className={cn("flex justify-between text-xs", Number(receivables?.overdue_usd) > 0 ? "text-destructive" : "text-muted-foreground")}>
                <span>Cuotas vencidas ({receivables?.overdue_count ?? 0})</span><span className="tabular-nums">{formatCurrency(receivables?.overdue_usd)}</span>
              </p>
              <p className="flex justify-between text-xs text-muted-foreground">
                <span>Cuotas próximos 7 días ({receivables?.due_week_count ?? 0})</span><span className="tabular-nums">{formatCurrency(receivables?.due_week_usd)}</span>
              </p>
              <div className="mt-1"><MoreLink to="/erp/receivables">Por cobrar</MoreLink></div>
            </div>
            <div className="border-t pt-3">
              {payables.length ? payables.map((row) => (
                <div key={row.currency}>
                  <p className="flex justify-between"><span>Por pagar ({row.currency})</span><b className="tabular-nums">{formatCurrency(row.pending, row.currency)}</b></p>
                  {Number(row.overdue) > 0 && (
                    <p className="flex justify-between text-xs text-destructive"><span>Vencido ({row.overdue_count})</span><span className="tabular-nums">{formatCurrency(row.overdue, row.currency)}</span></p>
                  )}
                </div>
              )) : <p className="text-muted-foreground">Nada por pagar.</p>}
              {payablesOverdue.length > 0 && <p className="mt-1 text-xs text-destructive">Hay cuentas por pagar vencidas.</p>}
              <div className="mt-1"><MoreLink to="/erp/payables">Por pagar</MoreLink></div>
            </div>
          </div>
        </ReportCard>
        <ReportCard title="Últimos movimientos">
          <ul className="space-y-2 text-sm">
            {(recent?.rows ?? []).map((row) => (
              <li key={`${row.source}-${row.id}`} className={cn("flex items-baseline justify-between gap-2", row.is_void && "text-muted-foreground line-through")}>
                <span className="min-w-0">
                  <span className="block truncate">{row.description || row.category_name || FINANCE_KIND_LABELS[row.kind]}</span>
                  <span className="text-xs text-muted-foreground">{formatShortDate(row.entry_date)} · {row.account_name}</span>
                </span>
                <span className={cn("shrink-0 font-medium tabular-nums", Number(row.signed_amount) < 0 ? "text-destructive" : "text-success")}>
                  {Number(row.signed_amount) > 0 ? "+" : ""}{formatCurrency(row.signed_amount, row.currency)}
                </span>
              </li>
            ))}
            {!recent?.rows.length && <li className="text-muted-foreground">Sin movimientos.</li>}
          </ul>
          <div className="mt-3"><MoreLink to="/erp/movements">Movimientos</MoreLink></div>
        </ReportCard>
      </div>
    </section>
  );
}
