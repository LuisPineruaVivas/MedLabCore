import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReceivablesReport } from "../types";
import { formatCurrency } from "../utils/currencyFormatters";
import { AGING_LABELS, AGING_ORDER, share } from "../utils/reports";
import { HorizontalBars, ReportCard } from "./ReportCharts";

interface AccountsReceivableReportProps {
  report: ReceivablesReport | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  onLoadMore?: () => void;
}

export function AccountsReceivableReport({ report, isLoading, isFetching, onLoadMore }: AccountsReceivableReportProps) {
  if (isLoading || !report) return <Skeleton className="h-64 rounded-xl" />;
  const total = Number(report.total_usd);

  return (
    <div className="space-y-4">
      <ReportCard title="Antigüedad de saldos" description={`Al ${format(new Date(`${report.as_of}T00:00:00`), "dd/MM/yyyy")} · total ${formatCurrency(total)}`}>
        <HorizontalBars
          emptyText="No hay saldos pendientes."
          rows={AGING_ORDER.map((bucket) => ({
            key: bucket,
            label: AGING_LABELS[bucket],
            value: Number(report.buckets[bucket] ?? 0),
            hint: `${share(Number(report.buckets[bucket] ?? 0), total)}%`,
          }))}
        />
      </ReportCard>

      <ReportCard title="Facturas pendientes" description="Vencimiento: próxima cuota sin pagar, o la fecha de la factura">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Antigüedad</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.invoices.length ? (
                report.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell><Link to={`/erp/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">{invoice.invoice_number}</Link></TableCell>
                    <TableCell>{invoice.patient_name}<p className="text-xs text-muted-foreground">{invoice.id_number}</p></TableCell>
                    <TableCell>{format(new Date(`${invoice.effective_due}T00:00:00`), "dd/MM/yyyy")}</TableCell>
                    <TableCell className={invoice.days_overdue > 0 ? "text-destructive" : undefined}>
                      {invoice.days_overdue > 0 ? `${invoice.days_overdue} días vencida` : AGING_LABELS.current}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(invoice.total_usd)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(invoice.balance_due_usd)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No hay cuentas pendientes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {report.invoices_total > report.invoices.length && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Mostrando las {report.invoices.length} más vencidas de {report.invoices_total.toLocaleString("es-VE")}.</span>
            {onLoadMore && (
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetching}>{isFetching ? "Cargando..." : "Mostrar más"}</Button>
            )}
          </div>
        )}
      </ReportCard>
    </div>
  );
}
