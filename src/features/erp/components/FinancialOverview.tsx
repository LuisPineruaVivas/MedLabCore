import { AlertTriangle, CalendarClock, DollarSign, HandCoins, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/StatCard";
import type { FinancialSummary, ProfitabilityReport } from "../types";
import { PAYMENT_METHOD_LABELS } from "../utils/cashRegister";
import { formatCurrency } from "../utils/currencyFormatters";
import { formatPercent, percentChange, share } from "../utils/reports";
import { DailyCollectedChart, HorizontalBars, ReportCard } from "./ReportCharts";

interface FinancialOverviewProps {
  summary: FinancialSummary | undefined;
  profitability: ProfitabilityReport | undefined;
  isLoading: boolean;
}

export function FinancialOverview({ summary, profitability, isLoading }: FinancialOverviewProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[120px] rounded-xl" />)}
      </div>
    );
  }

  const change = percentChange(Number(summary.collected_usd), Number(summary.previous_collected_usd));
  const collected = Number(summary.collected_usd);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Cobrado en el período"
          value={formatCurrency(collected)}
          subtitle={`${summary.payments_count} pago(s) · facturado ${formatCurrency(summary.billed_usd)}`}
          icon={DollarSign}
          trend={change === null ? undefined : { value: change, label: "% vs. período anterior" }}
        />
        <StatCard title="Cobrado hoy" value={formatCurrency(summary.collected_today_usd)} icon={CalendarClock} />
        <StatCard
          title="Cuentas por cobrar"
          value={formatCurrency(summary.receivables_usd)}
          subtitle={`${summary.receivables_count} factura(s)${Number(summary.overdue_usd) > 0 ? ` · vencido ${formatCurrency(summary.overdue_usd)}` : ""}`}
          icon={HandCoins}
        />
        <StatCard
          title="Margen bruto"
          value={formatPercent(profitability?.margin_pct)}
          subtitle={profitability ? `Órdenes con consumo confirmado: ${profitability.orders_count}` : "Calculando..."}
          icon={Percent}
        />
      </div>

      {Number(summary.overdue_usd) > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Hay {formatCurrency(summary.overdue_usd)} vencidos. Revisa la pestaña Cuentas por cobrar.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <ReportCard title="Cobrado por día" description="USD, incluye conversiones de bolívares a la tasa del pago" className="lg:col-span-3">
          <DailyCollectedChart data={summary.daily} />
        </ReportCard>
        <ReportCard title="Cobrado por método" description="Pagos no anulados del período" className="lg:col-span-2">
          <HorizontalBars
            emptyText="Sin cobros en el período."
            rows={summary.by_method.map((method) => ({
              key: method.name,
              label: `${method.name} · ${PAYMENT_METHOD_LABELS[method.method_type] ?? method.method_type}`,
              value: Number(method.total_usd),
              hint: `${share(Number(method.total_usd), collected)}%`,
            }))}
          />
        </ReportCard>
      </div>

      {summary.by_currency.length > 0 && (
        <ReportCard title="Cobrado por moneda">
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.by_currency.map((row) => (
              <div key={row.currency} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{row.currency}</p>
                <p className="text-lg font-semibold">{formatCurrency(row.amount, row.currency)}</p>
                {row.currency !== "USD" && <p className="text-xs text-muted-foreground">≈ {formatCurrency(row.amount_usd)}</p>}
              </div>
            ))}
          </div>
        </ReportCard>
      )}
    </div>
  );
}
