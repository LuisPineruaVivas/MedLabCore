import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProfitabilityReport as ProfitabilityData } from "../types";
import { formatCurrency } from "../utils/currencyFormatters";
import { formatPercent, LOW_MARGIN_PCT } from "../utils/reports";
import { ReportCard } from "./ReportCharts";

export function ProfitabilityReport({ report, isLoading }: { report: ProfitabilityData | undefined; isLoading: boolean }) {
  if (isLoading || !report) return <Skeleton className="h-64 rounded-xl" />;

  const lowMargin = report.by_test.filter((row) => row.margin_pct !== null && row.margin_pct < LOW_MARGIN_PCT);

  return (
    <div className="space-y-4">
      <ReportCard
        title="Análisis de rentabilidad"
        description={`Órdenes con consumo confirmado en el período (${report.orders_count}). El costo es el de los insumos descontados al costo promedio.`}
      >
        <dl className="max-w-md space-y-1.5 text-sm">
          <div className="flex justify-between"><dt>Ingresos</dt><dd className="tabular-nums">{formatCurrency(report.revenue_usd)}</dd></div>
          <div className="flex justify-between"><dt>(−) Costo de insumos</dt><dd className="tabular-nums">− {formatCurrency(report.supply_cost_usd)}</dd></div>
          <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Ganancia bruta</dt><dd className="tabular-nums">{formatCurrency(report.gross_profit_usd)}</dd></div>
          <div className="flex justify-between"><dt>Margen bruto</dt><dd className="tabular-nums">{formatPercent(report.margin_pct)}</dd></div>
          {Number(report.unassigned_cost_usd) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground"><dt>Incluye insumos extra sin examen asociado</dt><dd>{formatCurrency(report.unassigned_cost_usd)}</dd></div>
          )}
          {Number(report.exempted_cost_usd) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground"><dt>Incluye costo de órdenes exoneradas</dt><dd>{formatCurrency(report.exempted_cost_usd)}</dd></div>
          )}
        </dl>
      </ReportCard>

      {lowMargin.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {lowMargin.length} examen(es) con margen menor a {LOW_MARGIN_PCT}%: {lowMargin.map((row) => row.test_name).join(", ")}.
        </p>
      )}

      <ReportCard title="Rentabilidad por examen" description="Ordenado por ganancia. Los perfiles suman el costo de sus exámenes.">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Examen / perfil</TableHead>
                <TableHead className="text-right">Realizados</TableHead>
                <TableHead className="text-right">Precio prom.</TableHead>
                <TableHead className="text-right">Costo prom.</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.by_test.length ? (
                report.by_test.map((row) => (
                  <TableRow key={row.test_name}>
                    <TableCell className="font-medium">{row.test_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.performed}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.avg_price_usd === null ? "—" : formatCurrency(row.avg_price_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.avg_cost_usd ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.cost_usd)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.margin_pct !== null && row.margin_pct < LOW_MARGIN_PCT && "font-semibold text-destructive")}>
                      {formatPercent(row.margin_pct)}
                      {Number(row.cost_usd) === 0 && (
                        <p className="text-xs font-normal text-muted-foreground" title="Configura su receta en Exámenes → Insumos">sin insumos registrados</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No hay órdenes con consumo confirmado en el período. Configura las recetas en Exámenes → Insumos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ReportCard>
    </div>
  );
}
