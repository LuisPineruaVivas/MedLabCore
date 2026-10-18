import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter/static/Inter_18pt-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter/static/Inter_18pt-Bold.ttf", fontWeight: "bold" },
  ],
});

export interface ErpReportLabData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
}

export function createErpReportStyles(primaryColor: string) {
  return StyleSheet.create({
    page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, fontFamily: "Inter", color: "#334155" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 10 },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor, marginBottom: 2 },
    labDetails: { fontSize: 8.5, color: "#64748b", lineHeight: 1.35 },
    logo: { width: 170, height: 48, objectFit: "contain" },
    title: { fontSize: 15, fontWeight: "bold", color: "#0f172a", marginTop: 12 },
    subtitle: { fontSize: 9, color: "#64748b", marginBottom: 10 },
    kpis: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
    kpi: { width: "25%", padding: 6, borderWidth: 1, borderColor: "#e2e8f0" },
    kpiLabel: { fontSize: 7.5, color: "#64748b" },
    kpiValue: { fontSize: 12, fontWeight: "bold", color: "#0f172a", marginTop: 2 },
    sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#0f172a", marginTop: 12, marginBottom: 4 },
    tableHeader: { flexDirection: "row", backgroundColor: primaryColor, color: "#ffffff", paddingVertical: 4, paddingHorizontal: 5, fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#e2e8f0", paddingVertical: 4, paddingHorizontal: 5 },
    right: { textAlign: "right" },
    muted: { color: "#64748b" },
    note: { fontSize: 8, color: "#64748b", marginTop: 4 },
    footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#94a3b8" },
  });
}

export function ErpReportHeader({ labData, styles }: { labData?: ErpReportLabData; styles: ReturnType<typeof createErpReportStyles> }) {
  return (
    <View style={styles.header}>
      <View style={{ width: "55%" }}>
        <Text style={styles.labName}>{labData?.name || "Laboratorio"}</Text>
        {!!labData?.address && <Text style={styles.labDetails}>{labData.address}</Text>}
        {!!(labData?.phone || labData?.email) && <Text style={styles.labDetails}>{[labData?.phone, labData?.email].filter(Boolean).join(" · ")}</Text>}
      </View>
      {!!labData?.logo && <Image src={labData.logo} style={styles.logo} />}
    </View>
  );
}

export function ErpReportFooter({ generatedAt, styles }: { generatedAt: Date; styles: ReturnType<typeof createErpReportStyles> }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generado el {format(generatedAt, "dd/MM/yyyy HH:mm")} · MedLabCore</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export const formatReportDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};
