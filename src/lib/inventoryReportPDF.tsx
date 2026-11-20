import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { InventorySummary, Item } from "@/features/erp/types";
import { formatCurrency, formatUnitCost } from "@/features/erp/utils/currencyFormatters";
import { formatQuantity, isLowStock, ITEM_CATEGORY_LABELS } from "@/features/erp/utils/inventory";
import { createErpReportStyles, ErpReportFooter, ErpReportHeader, formatReportDate, type ErpReportLabData } from "./erpReportPDFParts";

interface InventoryReportPDFProps {
  summary: InventorySummary;
  /** Full catalog for the valuation table (also useful as a physical count sheet). */
  items: Item[];
  labData?: ErpReportLabData;
  generatedAt?: Date;
}

export function InventoryReportPDF({ summary, items, labData, generatedAt = new Date() }: InventoryReportPDFProps) {
  const styles = createErpReportStyles(labData?.primary_color || "#0ea5e9");
  const activeItems = items.filter((item) => item.is_active).sort((a, b) => a.name.localeCompare(b.name));
  const kpis = [
    ["Valor del inventario", formatCurrency(summary.total_value_usd)],
    ["Compras del período", formatCurrency(summary.purchases_usd)],
    ["Consumo del período", formatCurrency(summary.consumption_usd)],
    ["Pérdidas y ajustes", formatCurrency(summary.losses_usd)],
  ];

  return (
    <Document title={`Reporte de inventario ${summary.date_from} a ${summary.date_to}`}>
      <Page size="LETTER" style={styles.page}>
        <ErpReportHeader labData={labData} styles={styles} />
        <Text style={styles.title}>Reporte de inventario</Text>
        <Text style={styles.subtitle}>
          Movimientos del {formatReportDate(summary.date_from)} al {formatReportDate(summary.date_to)} · valores en USD al costo promedio ponderado
        </Text>

        <View style={styles.kpis}>
          {kpis.map(([label, value]) => (
            <View key={label} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue}>{value}</Text>
            </View>
          ))}
        </View>

        {summary.expiring_soon.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Por vencer en 30 días</Text>
            {summary.expiring_soon.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={{ width: "50%" }}>{item.name}{item.lot_number ? ` · lote ${item.lot_number}` : ""}</Text>
                <Text style={{ width: "25%" }}>{formatReportDate(item.expiration_date)}</Text>
                <Text style={[{ width: "25%" }, styles.right]}>{formatQuantity(item.current_stock, item.unit_of_measure)}</Text>
              </View>
            ))}
          </>
        )}

        {summary.top_consumed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Insumos más consumidos</Text>
            {summary.top_consumed.map((row) => (
              <View key={row.item_id} style={styles.tableRow}>
                <Text style={{ width: "55%" }}>{row.name}</Text>
                <Text style={[{ width: "25%" }, styles.right]}>{formatQuantity(row.quantity, row.unit_of_measure)}</Text>
                <Text style={[{ width: "20%" }, styles.right]}>{formatCurrency(row.cost_usd)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Existencias y valoración ({activeItems.length} insumos)</Text>
        <View style={styles.tableHeader} fixed>
          <Text style={{ width: "9%" }}>Código</Text>
          <Text style={{ width: "29%" }}>Insumo</Text>
          <Text style={{ width: "14%" }}>Categoría</Text>
          <Text style={[{ width: "13%" }, styles.right]}>Stock</Text>
          <Text style={[{ width: "8%" }, styles.right]}>Mín.</Text>
          <Text style={[{ width: "14%", paddingLeft: 4 }, styles.right]}>Costo</Text>
          <Text style={[{ width: "13%", paddingLeft: 4 }, styles.right]}>Valor</Text>
        </View>
        {activeItems.map((item) => (
          <View key={item.id} style={styles.tableRow} wrap={false}>
            <Text style={{ width: "9%" }}>{item.code ?? "—"}</Text>
            <Text style={{ width: "29%" }}>{item.name}{isLowStock(item) ? " (bajo mínimo)" : ""}</Text>
            <Text style={{ width: "14%" }}>{ITEM_CATEGORY_LABELS[item.category]}</Text>
            <Text style={[{ width: "13%" }, styles.right]}>{formatQuantity(item.current_stock, item.unit_of_measure)}</Text>
            <Text style={[{ width: "8%" }, styles.right]}>{formatQuantity(item.min_stock)}</Text>
            <Text style={[{ width: "14%", paddingLeft: 4 }, styles.right]}>{formatUnitCost(item.unit_cost)}</Text>
            <Text style={[{ width: "13%", paddingLeft: 4 }, styles.right]}>{formatCurrency(item.total_value)}</Text>
          </View>
        ))}

        <ErpReportFooter generatedAt={generatedAt} styles={styles} />
      </Page>
    </Document>
  );
}
