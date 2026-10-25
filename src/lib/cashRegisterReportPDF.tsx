import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { CashSession, CashSessionTotals } from "@/features/erp/types";
import { buildCashReconciliation, describeDifference, PAYMENT_METHOD_LABELS, sortCurrencies } from "@/features/erp/utils/cashRegister";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter/static/Inter_18pt-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter/static/Inter_18pt-Bold.ttf", fontWeight: "bold" },
  ],
});

interface CashRegisterReportPDFProps {
  session: CashSession;
  /** Expected totals; for an open session pass the live summary. */
  totals: CashSessionTotals;
  generatedAt?: Date;
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
  };
}

const STATUS_LABELS: Record<CashSession["status"], string> = { open: "Abierta", closed: "Cerrada", reviewed: "Revisada" };
const formatDate = (value: string | null) => (value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "—");

export function CashRegisterReportPDF({ session, totals, generatedAt = new Date(), labData }: CashRegisterReportPDFProps) {
  const primaryColor = labData?.primary_color || "#0ea5e9";
  const rows = buildCashReconciliation(totals, session.actual_totals ?? {});
  const currencies = sortCurrencies(Object.keys(totals));

  const styles = StyleSheet.create({
    page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9.5, fontFamily: "Inter", color: "#334155" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 10 },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor, marginBottom: 2 },
    labDetails: { fontSize: 8.5, color: "#64748b", lineHeight: 1.35 },
    logo: { width: 180, height: 50, objectFit: "contain" },
    title: { fontSize: 16, fontWeight: "bold", color: "#0f172a", marginTop: 14, marginBottom: 2 },
    subtitle: { fontSize: 9, color: "#64748b", marginBottom: 10 },
    infoBox: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8, rowGap: 4, marginBottom: 12 },
    infoCell: { width: "50%" },
    label: { fontWeight: "bold", color: "#475569" },
    sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#0f172a", marginTop: 8, marginBottom: 4 },
    tableHeader: { flexDirection: "row", backgroundColor: primaryColor, color: "#ffffff", paddingVertical: 5, paddingHorizontal: 6, fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.7, borderBottomColor: "#e2e8f0", paddingVertical: 5, paddingHorizontal: 6 },
    // Cash table: 10 + 4 x 17 + 22 = 100%.
    cashCurrency: { width: "10%" },
    cashCell: { width: "17%", textAlign: "right", paddingLeft: 4 },
    cashDiff: { width: "22%", textAlign: "right", paddingLeft: 4 },
    // Methods table: 34 + 20 + 12 + 12 + 22 = 100%.
    methodName: { width: "34%" },
    methodType: { width: "20%" },
    methodSmall: { width: "12%", textAlign: "right" },
    methodTotal: { width: "22%", textAlign: "right" },
    note: { fontSize: 8.5, color: "#64748b", marginTop: 4, lineHeight: 1.35 },
    notesBox: { marginTop: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
    signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
    signature: { width: "40%", borderTopWidth: 1, borderTopColor: "#94a3b8", paddingTop: 4, textAlign: "center", fontSize: 8.5 },
    footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6, textAlign: "center", fontSize: 7.5, color: "#94a3b8" },
  });

  return (
    <Document title={`Cierre de caja ${formatDate(session.opened_at)}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={{ width: "55%" }}>
            <Text style={styles.labName}>{labData?.name || "Laboratorio"}</Text>
            {!!labData?.address && <Text style={styles.labDetails}>{labData.address}</Text>}
            {!!(labData?.phone || labData?.email) && (
              <Text style={styles.labDetails}>{[labData?.phone, labData?.email].filter(Boolean).join(" · ")}</Text>
            )}
          </View>
          {!!labData?.logo && <Image src={labData.logo} style={styles.logo} />}
        </View>

        <Text style={styles.title}>Reporte de cierre de caja</Text>
        <Text style={styles.subtitle}>Conciliación del efectivo contado contra los cobros registrados en la sesión.</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoCell}><Text style={styles.label}>Operador: </Text>{session.operator_name}</Text>
          <Text style={styles.infoCell}><Text style={styles.label}>Estado: </Text>{STATUS_LABELS[session.status]}</Text>
          <Text style={styles.infoCell}><Text style={styles.label}>Apertura: </Text>{formatDate(session.opened_at)}</Text>
          <Text style={styles.infoCell}><Text style={styles.label}>Cierre: </Text>{formatDate(session.closed_at)}</Text>
          {session.reviewed_at && <Text style={styles.infoCell}><Text style={styles.label}>Revisión: </Text>{formatDate(session.reviewed_at)}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Efectivo en caja</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cashCurrency}>Moneda</Text>
          <Text style={styles.cashCell}>Fondo inicial</Text>
          <Text style={styles.cashCell}>Cobros efectivo</Text>
          <Text style={styles.cashCell}>Esperado</Text>
          <Text style={styles.cashCell}>Contado</Text>
          <Text style={styles.cashDiff}>Diferencia</Text>
        </View>
        {rows.map((row) => (
          <View key={row.currency} style={styles.tableRow}>
            <Text style={styles.cashCurrency}>{row.currency}</Text>
            <Text style={styles.cashCell}>{formatCurrency(row.opening, row.currency)}</Text>
            <Text style={styles.cashCell}>{formatCurrency(row.cashPayments, row.currency)}</Text>
            <Text style={styles.cashCell}>{formatCurrency(row.cashExpected, row.currency)}</Text>
            <Text style={styles.cashCell}>{row.counted === null ? "—" : formatCurrency(row.counted, row.currency)}</Text>
            <Text style={styles.cashDiff}>
              {row.difference === null ? "—" : `${formatCurrency(row.difference, row.currency)} (${describeDifference(row.difference)})`}
            </Text>
          </View>
        ))}
        <Text style={styles.note}>
          Efectivo esperado = fondo inicial + cobros en efectivo. Los medios electrónicos se concilian contra el estado de cuenta bancario.
        </Text>

        <Text style={styles.sectionTitle}>Cobros por método</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.methodName}>Método</Text>
          <Text style={styles.methodType}>Tipo</Text>
          <Text style={styles.methodSmall}>Moneda</Text>
          <Text style={styles.methodSmall}>Pagos</Text>
          <Text style={styles.methodTotal}>Total</Text>
        </View>
        {currencies.flatMap((currency) =>
          (totals[currency]?.by_method ?? []).map((method) => (
            <View key={`${currency}-${method.name}`} style={styles.tableRow}>
              <Text style={styles.methodName}>{method.name}</Text>
              <Text style={styles.methodType}>{PAYMENT_METHOD_LABELS[method.method_type] ?? method.method_type}</Text>
              <Text style={styles.methodSmall}>{currency}</Text>
              <Text style={styles.methodSmall}>{method.count}</Text>
              <Text style={styles.methodTotal}>{formatCurrency(method.total, currency)}</Text>
            </View>
          ))
        )}
        {currencies.every((currency) => !(totals[currency]?.by_method ?? []).length) && (
          <View style={styles.tableRow}><Text>Sin cobros registrados en esta sesión.</Text></View>
        )}

        {(session.notes || session.closing_notes || session.review_notes) && (
          <View style={styles.notesBox}>
            {session.notes && <Text><Text style={styles.label}>Apertura: </Text>{session.notes}</Text>}
            {session.closing_notes && <Text><Text style={styles.label}>Cierre: </Text>{session.closing_notes}</Text>}
            {session.review_notes && <Text><Text style={styles.label}>Revisión: </Text>{session.review_notes}</Text>}
          </View>
        )}

        <View style={styles.signatures}>
          <Text style={styles.signature}>Operador de caja</Text>
          <Text style={styles.signature}>Supervisor / Administrador</Text>
        </View>

        <Text style={styles.footer} fixed>Generado el {format(generatedAt, "dd/MM/yyyy HH:mm")} · MedLabCore</Text>
      </Page>
    </Document>
  );
}
