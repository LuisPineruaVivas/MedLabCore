import { useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { BarChart3, Boxes, FileDown, HandCoins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { cn } from "@/lib/utils";
import { buildLabData } from "@/features/orders/OrderDetailSections";
import { AccountsReceivableReport } from "@/features/erp/components/AccountsReceivableReport";
import { FinancialOverview } from "@/features/erp/components/FinancialOverview";
import { InventoryDashboard } from "@/features/erp/components/InventoryDashboard";
import { ProfitabilityReport } from "@/features/erp/components/ProfitabilityReport";
import { PeriodFilter } from "@/features/erp/components/ReportCharts";
import { useFinancialSummary, useInventorySummary, useProfitabilityReport, useReceivablesReport } from "@/features/erp/hooks/useErpReports";
import { useItems } from "@/features/erp/hooks/useInventory";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { buildPeriod, isValidPeriod, type ReportPeriod } from "@/features/erp/utils/reports";
import { FinancialReportPDF } from "@/lib/financialReportPDF";
import { InventoryReportPDF } from "@/lib/inventoryReportPDF";

type ReportTab = "finance" | "profitability" | "inventory" | "receivables";

const TABS: { id: ReportTab; label: string; icon: typeof BarChart3; financial: boolean }[] = [
  { id: "finance", label: "Finanzas", icon: BarChart3, financial: true },
  { id: "profitability", label: "Rentabilidad", icon: TrendingUp, financial: true },
  { id: "receivables", label: "Cuentas por cobrar", icon: HandCoins, financial: true },
  { id: "inventory", label: "Inventario", icon: Boxes, financial: false },
];

export default function FinancialDashboardPage() {
  const { orgId, organization } = useCurrentOrgContext();
  const { canViewFinancialReports, canManageInventory } = useErpModule();
  const tabs = TABS.filter((tab) => (tab.financial ? canViewFinancialReports : canManageInventory));
  const [activeTab, setActiveTab] = useState<ReportTab>(tabs[0]?.id ?? "inventory");
  const [period, setPeriod] = useState<ReportPeriod>(() => buildPeriod("this_month"));
  const [exporting, setExporting] = useState(false);
  const labData = useMemo(() => buildLabData(organization), [organization]);

  const isFinancialTab = activeTab !== "inventory";
  // The summary feeds the financial PDF, so it loads on every financial tab.
  const financial = useFinancialSummary(orgId, period, canViewFinancialReports && isFinancialTab);
  const profitability = useProfitabilityReport(orgId, period, canViewFinancialReports && (activeTab === "finance" || activeTab === "profitability"));
  const [receivablesLimit, setReceivablesLimit] = useState(200);
  const receivables = useReceivablesReport(orgId, canViewFinancialReports && isFinancialTab, receivablesLimit);
  const inventory = useInventorySummary(orgId, period, canManageInventory && activeTab === "inventory");
  const { data: items = [] } = useItems(canManageInventory && activeTab === "inventory" ? orgId : null);

  const activeQuery = { finance: financial, profitability, receivables, inventory }[activeTab];

  async function handleExport() {
    setExporting(true);
    try {
      const document =
        activeTab === "inventory"
          ? inventory.data && <InventoryReportPDF summary={inventory.data} items={items} labData={labData} />
          : financial.data && (
              <FinancialReportPDF
                summary={financial.data}
                profitability={profitability.data}
                receivables={receivables.data}
                labData={labData}
              />
            );
      if (!document) {
        toast.error("Espera a que cargue el reporte para exportarlo.");
        return;
      }
      const blob = await pdf(document).toBlob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (error) {
      console.error("Error exportando el reporte:", error);
      toast.error("No se pudo generar el PDF.");
    } finally {
      setExporting(false);
    }
  }

  const exportReady = isFinancialTab ? !!financial.data : !!inventory.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reportes"
        description="Indicadores financieros, rentabilidad por examen, inventario y antigüedad de saldos."
        actions={
          <Button variant="outline" onClick={handleExport} disabled={exporting || !exportReady}>
            <FileDown className="mr-2 h-4 w-4" />{exporting ? "Generando..." : "Exportar PDF"}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="mr-1.5 inline-block h-4 w-4" />{tab.label}
            </button>
          ))}
        </div>
        {activeTab !== "receivables" && <PeriodFilter value={period} onChange={setPeriod} />}
      </div>

      {!isValidPeriod(period) && activeTab !== "receivables" && (
        <p className="text-sm text-destructive">El rango de fechas no es válido.</p>
      )}
      {activeQuery.isError && <p className="text-sm text-destructive">{getErpErrorMessage(activeQuery.error)}</p>}

      {activeTab === "finance" && <FinancialOverview summary={financial.data} profitability={profitability.data} isLoading={financial.isLoading} />}
      {activeTab === "profitability" && <ProfitabilityReport report={profitability.data} isLoading={profitability.isLoading} />}
      {activeTab === "receivables" && <AccountsReceivableReport
          report={receivables.data}
          isLoading={receivables.isLoading}
          isFetching={receivables.isFetching}
          onLoadMore={() => setReceivablesLimit((value) => value + 200)}
        />}
      {activeTab === "inventory" && <InventoryDashboard summary={inventory.data} isLoading={inventory.isLoading} />}
    </div>
  );
}
