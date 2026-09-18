import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter/static/Inter_18pt-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter/static/Inter_18pt-Bold.ttf", fontWeight: "bold" },
  ],
});

export interface AffiliateStatementOrderRow {
  id: string;
  order_seq: number | null;
  created_at: string;
  payment_status: string;
  total_amount: number;
  patients: {
    first_name: string;
    last_name: string;
    id_number: string;
  } | null;
}

interface AffiliateAccountStatementPDFProps {
  affiliateName: string;
  affiliateEmail?: string | null;
  orders: AffiliateStatementOrderRow[];
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

export function AffiliateAccountStatementPDF({
  affiliateName,
  affiliateEmail,
  orders,
  generatedAt = new Date(),
  labData,
}: AffiliateAccountStatementPDFProps) {
  const primaryColor = labData?.primary_color || "#0ea5e9";
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  const styles = StyleSheet.create({
    page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 36, fontSize: 10, fontFamily: "Inter", color: "#334155" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 10 },
    labInfo: { width: "48%" },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor, marginBottom: 2 },
    labDetails: { fontSize: 9, color: "#64748b", lineHeight: 1.35 },
    logoWrap: { width: "38%", alignItems: "flex-end" },
    logo: { width: 220, height: 60, objectFit: "contain" },
    titleBlock: { marginTop: 14, marginBottom: 10 },
    title: { fontSize: 16, fontWeight: "bold", color: "#0f172a", marginBottom: 3 },
    subtitle: { fontSize: 9.5, color: "#64748b" },
    summaryBox: { marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: primaryColor, borderRadius: 4, backgroundColor: "#f8fafc", padding: 8 },
    summaryRow: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
    summaryCellWide: { width: "60%" },
    summaryCell: { width: "40%" },
    label: { fontWeight: "bold", color: "#475569" },
    tableHeader: { flexDirection: "row", backgroundColor: primaryColor, color: "#ffffff", paddingVertical: 6, paddingHorizontal: 6, marginTop: 6 },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.7, borderBottomColor: "#e2e8f0", paddingVertical: 6, paddingHorizontal: 6 },
    colOrder: { width: "15%", paddingRight: 4 },
    colDate: { width: "19%", paddingRight: 4 },
    colPatient: { width: "28%", paddingRight: 4 },
    colId: { width: "16%", paddingRight: 4 },
    colAmount: { width: "12%", textAlign: "right", paddingRight: 4 },
    colStatus: { width: "10%", textAlign: "right" },
    totalBox: { marginTop: 14, marginLeft: "auto", width: 210, borderWidth: 1, borderColor: primaryColor, borderRadius: 4, padding: 10, backgroundColor: "#f8fafc" },
    totalLabel: { fontSize: 10, color: "#475569", marginBottom: 4 },
    totalValue: { fontSize: 18, fontWeight: "bold", color: primaryColor, textAlign: "right" },
    footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, textAlign: "center", fontSize: 8, color: "#94a3b8" },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.labInfo}>
            <Text style={styles.labName}>{labData?.name || "LABORATORIO CLINICO"}</Text>
            {labData?.address ? <Text style={styles.labDetails}>{labData.address}</Text> : null}
            {labData?.phone ? <Text style={styles.labDetails}>Tel: {labData.phone}</Text> : null}
            {labData?.email ? <Text style={styles.labDetails}>Email: {labData.email}</Text> : null}
          </View>
          {labData?.logo ? (
            <View style={styles.logoWrap}>
              <Image src={labData.logo} style={styles.logo} />
            </View>
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Cuenta de Cobro de Afiliado</Text>
          <Text style={styles.subtitle}>Detalle de ordenes seleccionadas para conciliacion y pago</Text>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCellWide}>
              <Text>
                <Text style={styles.label}>Afiliado: </Text>
                {affiliateName}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text>
                <Text style={styles.label}>Emision: </Text>
                {format(generatedAt, "dd/MM/yyyy")}
              </Text>
            </View>
            {affiliateEmail ? (
              <View style={styles.summaryCellWide}>
                <Text>
                  <Text style={styles.label}>Correo: </Text>
                  {affiliateEmail}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryCell}>
              <Text>
                <Text style={styles.label}>Hora: </Text>
                {format(generatedAt, "HH:mm")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colOrder}>ORDEN</Text>
          <Text style={styles.colDate}>FECHA</Text>
          <Text style={styles.colPatient}>PACIENTE</Text>
          <Text style={styles.colId}>CEDULA</Text>
          <Text style={styles.colAmount}>MONTO</Text>
        </View>

        {orders.map((order) => {
          const patientName = order.patients
            ? `${order.patients.first_name} ${order.patients.last_name}`.trim().toUpperCase()
            : "PACIENTE NO DISPONIBLE";

          return (
            <View key={order.id} style={styles.tableRow}>
              <Text style={styles.colOrder}>#{String(order.order_seq ?? "").padStart(4, "0")}</Text>
              <Text style={styles.colDate}>{format(new Date(order.created_at), "dd/MM/yyyy")}</Text>
              <Text style={styles.colPatient}>{patientName}</Text>
              <Text style={styles.colId}>{order.patients?.id_number ?? ""}</Text>
              <Text style={styles.colAmount}>${Number(order.total_amount).toFixed(2)}</Text>
            </View>
          );
        })}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Monto total a pagar</Text>
          <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Soporte de cuenta corriente generado por Medlabcore.
        </Text>
      </Page>
    </Document>
  );
}
