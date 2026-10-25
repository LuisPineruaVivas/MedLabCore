import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useErpModule } from "@/hooks/useErpModule";
import { useFinancialSummary } from "../hooks/useErpReports";
import { useItems } from "../hooks/useInventory";
import { formatCurrency } from "../utils/currencyFormatters";
import { formatQuantity, getLowStockItems } from "../utils/inventory";
import { buildPeriod } from "../utils/reports";

/** Month-to-date finance KPIs and low-stock alerts on the main dashboard; renders nothing without the ERP. */
export function ErpDashboardWidgets({ orgId }: { orgId: string | null }) {
  const { isErpEnabled, canViewFinancialReports, canManageInventory } = useErpModule();
  const [period] = useState(() => buildPeriod("this_month"));
  const { data: summary } = useFinancialSummary(orgId, period, isErpEnabled && canViewFinancialReports);
  const { data: items = [] } = useItems(isErpEnabled && canManageInventory ? orgId : null);
  const lowStock = getLowStockItems(items);

  if (!isErpEnabled || (!canViewFinancialReports && !canManageInventory)) return null;

  const kpis = summary
    ? [
        { label: "Cobrado hoy", value: formatCurrency(summary.collected_today_usd) },
        { label: "Cobrado este mes", value: formatCurrency(summary.collected_usd) },
        { label: "Por cobrar", value: formatCurrency(summary.receivables_usd) },
        { label: "Vencido", value: formatCurrency(summary.overdue_usd), alert: Number(summary.overdue_usd) > 0 },
      ]
    : [];

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Administración</h2>
        <Link to="/erp/reports" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Ver reportes<ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={kpi.alert ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}
      {canManageInventory && lowStock.length > 0 && (
        <Link to="/erp/inventory" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {lowStock.length} insumo(s) bajo el stock mínimo:{" "}
            {lowStock.slice(0, 4).map((item) => `${item.name} (${formatQuantity(item.current_stock, item.unit_of_measure)})`).join(", ")}
            {lowStock.length > 4 && "…"}
          </span>
        </Link>
      )}
    </section>
  );
}
