import { format } from "date-fns";
import { AlertTriangle, Boxes, PackageMinus, PackagePlus, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/StatCard";
import type { InventorySummary } from "../types";
import { formatCurrency } from "../utils/currencyFormatters";
import { formatQuantity, ITEM_CATEGORY_LABELS } from "../utils/inventory";
import { HorizontalBars, ReportCard } from "./ReportCharts";

export function InventoryDashboard({ summary, isLoading }: { summary: InventorySummary | undefined; isLoading: boolean }) {
  if (isLoading || !summary) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Valor del inventario" value={formatCurrency(summary.total_value_usd)} subtitle={`${summary.active_items} insumos activos`} icon={Wallet} />
        <StatCard title="Compras del período" value={formatCurrency(summary.purchases_usd)} icon={PackagePlus} />
        <StatCard title="Consumo del período" value={formatCurrency(summary.consumption_usd)} icon={PackageMinus} />
        <StatCard title="Pérdidas y ajustes" value={formatCurrency(summary.losses_usd)} subtitle="Salidas por ajuste" icon={Boxes} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Bajo stock mínimo">
          {summary.low_stock.length ? (
            <ul className="divide-y text-sm">
              {summary.low_stock.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />{item.name}</span>
                  <span className="tabular-nums">{formatQuantity(item.current_stock, item.unit_of_measure)} / mín. {formatQuantity(item.min_stock)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todos los insumos están sobre su mínimo.</p>
          )}
        </ReportCard>
        <ReportCard title="Por vencer (30 días)" description="Según el lote más reciente registrado de cada insumo">
          {summary.expiring_soon.length ? (
            <ul className="divide-y text-sm">
              {summary.expiring_soon.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{item.name}{item.lot_number ? ` · lote ${item.lot_number}` : ""}</span>
                  <span className="tabular-nums">{format(new Date(`${item.expiration_date}T00:00:00`), "dd/MM/yyyy")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ningún insumo vence en los próximos 30 días.</p>
          )}
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Insumos más consumidos" description="Por costo en el período">
          <HorizontalBars
            emptyText="Sin consumos en el período."
            rows={summary.top_consumed.map((row) => ({
              key: row.item_id,
              label: row.name,
              value: Number(row.cost_usd),
              hint: formatQuantity(row.quantity, row.unit_of_measure),
            }))}
          />
        </ReportCard>
        <ReportCard title="Valor por categoría">
          <HorizontalBars
            emptyText="Sin insumos con valor."
            rows={summary.value_by_category.map((row) => ({
              key: row.category,
              label: ITEM_CATEGORY_LABELS[row.category] ?? row.category,
              value: Number(row.value_usd),
              hint: `${row.items} insumo(s)`,
            }))}
          />
        </ReportCard>
      </div>
    </div>
  );
}
