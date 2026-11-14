import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useErpModule } from "@/hooks/useErpModule";
import { useItems } from "../hooks/useInventory";
import { formatQuantity, getLowStockItems } from "../utils/inventory";
import { FinancePanel } from "./FinancePanel";

/** Finance panel (admins) and low-stock alerts on the main dashboard; renders nothing without the ERP. */
export function ErpDashboardWidgets({ orgId }: { orgId: string | null }) {
  const { isErpEnabled, canViewFinancialReports, canManageInventory } = useErpModule();
  const { data: items = [] } = useItems(isErpEnabled && canManageInventory ? orgId : null);
  const lowStock = getLowStockItems(items);

  if (!isErpEnabled || (!canViewFinancialReports && !canManageInventory)) return null;

  return (
    <div className="space-y-3">
      {canViewFinancialReports && <FinancePanel orgId={orgId} />}
      {canManageInventory && lowStock.length > 0 && (
        <Link to="/erp/inventory" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning hover:bg-warning/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {lowStock.length} insumo(s) bajo el stock mínimo:{" "}
            {lowStock.slice(0, 4).map((item) => `${item.name} (${formatQuantity(item.current_stock, item.unit_of_measure)})`).join(", ")}
            {lowStock.length > 4 && "…"}
          </span>
        </Link>
      )}
    </div>
  );
}
