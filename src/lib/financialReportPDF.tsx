import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { FinancialSummary, ProfitabilityReport, ReceivablesReport } from "@/features/erp/types";
import { PAYMENT_METHOD_LABELS } from "@/features/erp/utils/cashRegister";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { AGING_LABELS, AGING_ORDER, formatPercent, share } from "@/features/erp/utils/reports";
import { createErpReportStyles, ErpReportFooter, ErpReportHeader, formatReportDate, type ErpReportLabData } from "./erpReportPDFParts";

interface FinancialReportPDFProps {
  summary: FinancialSummary;
  profitability?: ProfitabilityReport;
  receivables?: ReceivablesReport;
  labData?: ErpReportLabData;
  generatedAt?: Date;
}

export function FinancialReportPDF({ summary, profitability, receivables, labData, generatedAt = new Date() }: FinancialReportPDFProps) {
  const styles = createErpReportStyles(labData?.primary_color || "#0ea5e9");
  const collected = Number(summary.collected_usd);
  const kpis = [
    ["Cobrado", formatCurrency(collected)],
    ["Facturado", formatCurrency(summary.billed_usd)],
    ["Por cobrar", formatCurrency(summary.receivables_usd)],
    ["Vencido", formatCurrency(summary.overdue_usd)],
    ["Ingresos (rentabilidad)", formatCurrency(profitability?.revenue_usd ?? 0)],
    ["Costo de insumos", formatCurrency(profitability?.supply_cost_usd ?? summary.supply_cost_usd)],
    ["Ganancia bruta", formatCurrency(profitability?.gross_profit_usd ?? 0)],
    ["Margen bruto", formatPercent(profitability?.margin_pct)],
  ];

  return (
    <Document title={`Reporte financiero ${summary.date_from} a ${summary.date_to}`}>
      <Page size="LETTER" style={styles.page}>
        <ErpReportHeader labData={labData} styles={styles} />
        <Text style={styles.title}>Reporte financiero</Text>
        <Text style={styles.subtitle}>Período: {formatReportDate(summary.date_from)} al {formatReportDate(summary.date_to)} · montos en USD</Text>

        <View style={styles.kpis}>
          {kpis.map(([label, value]) => (
            <View key={label} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={styles.kpiValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Cobrado = pagos no anulados del período. Facturado = facturas emitidas en el período. La rentabilidad considera sólo órdenes con consumo de insumos confirmado.</Text>

        <Text style={styles.sectionTitle}>Cobrado por método</Text>
        <View style={styles.tableHeader}>
          <Text style={{ width: "40%" }}>Método</Text>
          <Text style={{ width: "20%" }}>Tipo</Text>
          <Text style={[{ width: "12%" }, styles.right]}>Pagos</Text>
          <Text style={[{ width: "16%" }, styles.right]}>Total</Text>
          <Text style={[{ width: "12%" }, styles.right]}>%</Text>
        </View>
        {summary.by_method.length ? (
          summary.by_method.map((method) => (
            <View key={method.name} style={styles.tableRow}>
              <Text style={{ width: "40%" }}>{method.name}</Text>
              <Text style={{ width: "20%" }}>{PAYMENT_METHOD_LABELS[method.method_type] ?? method.method_type}</Text>
              <Text style={[{ width: "12%" }, styles.right]}>{method.count}</Text>
              <Text style={[{ width: "16%" }, styles.right]}>{formatCurrency(method.total_usd)}</Text>
              <Text style={[{ width: "12%" }, styles.right]}>{share(Number(method.total_usd), collected)}%</Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}><Text style={styles.muted}>Sin cobros en el período.</Text></View>
        )}

        {summary.by_currency.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Cobrado por moneda</Text>
            {summary.by_currency.map((row) => (
              <View key={row.currency} style={styles.tableRow}>
                <Text style={{ width: "30%" }}>{row.currency}</Text>
                <Text style={[{ width: "35%" }, styles.right]}>{formatCurrency(row.amount, row.currency)}</Text>
                <Text style={[{ width: "35%" }, styles.right]}>≈ {formatCurrency(row.amount_usd)}</Text>
              </View>
            ))}
          </>
        )}

        {receivables && (
          <>
            <Text style={styles.sectionTitle}>Antigüedad de cuentas por cobrar (al {formatReportDate(receivables.as_of)})</Text>
            {AGING_ORDER.map((bucket) => (
              <View key={bucket} style={styles.tableRow}>
                <Text style={{ width: "50%" }}>{AGING_LABELS[bucket]}</Text>
                <Text style={[{ width: "30%" }, styles.right]}>{formatCurrency(receivables.buckets[bucket] ?? 0)}</Text>
                <Text style={[{ width: "20%" }, styles.right]}>{share(Number(receivables.buckets[bucket] ?? 0), Number(receivables.total_usd))}%</Text>
              </View>
            ))}
          </>
        )}

        {profitability && (
          <>
            <Text style={styles.sectionTitle} break={profitability.by_test.length > 12}>Rentabilidad por examen</Text>
            <View style={styles.tableHeader}>
              <Text style={{ width: "34%" }}>Examen / perfil</Text>
              <Text style={[{ width: "11%" }, styles.right]}>Realizados</Text>
              <Text style={[{ width: "14%" }, styles.right]}>Ingresos</Text>
              <Text style={[{ width: "14%" }, styles.right]}>Costo</Text>
              <Text style={[{ width: "15%" }, styles.right]}>Ganancia</Text>
              <Text style={[{ width: "12%" }, styles.right]}>Margen</Text>
            </View>
            {profitability.by_test.length ? (
              profitability.by_test.map((row) => (
                <View key={row.test_name} style={styles.tableRow} wrap={false}>
                  <Text style={{ width: "34%" }}>{row.test_name}</Text>
                  <Text style={[{ width: "11%" }, styles.right]}>{row.performed}</Text>
                  <Text style={[{ width: "14%" }, styles.right]}>{formatCurrency(row.revenue_usd)}</Text>
                  <Text style={[{ width: "14%" }, styles.right]}>{formatCurrency(row.cost_usd)}</Text>
                  <Text style={[{ width: "15%" }, styles.right]}>{formatCurrency(Number(row.revenue_usd) - Number(row.cost_usd))}</Text>
                  <Text style={[{ width: "12%" }, styles.right]}>{formatPercent(row.margin_pct)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}><Text style={styles.muted}>Sin órdenes con consumo confirmado en el período.</Text></View>
            )}
          </>
        )}

        <ErpReportFooter generatedAt={generatedAt} styles={styles} />
      </Page>
    </Document>
  );
}
