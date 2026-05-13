import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { getFieldResultMeta } from "@/features/tests/schemas";
import { getCategoryStyle } from "@/utils/validators";
import type { OrderRow } from "@/features/orders/schemas";

Font.register({
  family: "Inter",
  fonts: [{ src: "/fonts/Inter/Inter-VariableFont_opsz,wght.ttf" }],
});

interface UnifiedProps {
  orden: OrderRow;
  orderItems: any[];
  departmentOrder?: string[];
  patientData: {
    name: string;
    id: string;
    age: string | number;
    gender: string;
  };
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
  };
}

interface FlatRow {
  fieldLabel: string;
  value: string;
  unit: string;
  rangeDisplay: string;
  isOutOfRange: boolean;
  resultColor?: string;
  isSectionHeader?: boolean;
  fieldType?: string;
}

const shouldRenderSignatureBlock = (order: OrderRow) =>
  order.status === "completada" && Boolean(order.firma_url || order.sello_url);

function buildDepartmentOrderMap(departmentOrder: string[] = []) {
  return new Map(departmentOrder.map((department, index) => [department, index] as const));
}

function sortCategoriesByDepartmentOrder(categories: string[], departmentOrder: string[] = []) {
  const orderMap = buildDepartmentOrderMap(departmentOrder);

  return [...categories].sort((left, right) => {
    const leftIndex = orderMap.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex === rightIndex) {
      return left.localeCompare(right);
    }

    return leftIndex - rightIndex;
  });
}

export const UnifiedTestReportPDF = ({ orden, orderItems, departmentOrder = [], patientData, labData }: UnifiedProps) => {
  const lab = labData || { name: "LABORATORIO CLINICO", address: "Av. Principal 123", phone: "555-0123", email: "" };
  const patientAge =
    typeof patientData?.age === "number"
      ? patientData.age
      : typeof patientData?.age === "string"
        ? parseInt(patientData.age, 10) || undefined
        : undefined;
  const patientGender = patientData?.gender;
  const primaryColor = labData?.primary_color || "#0ea5e9";

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 11, fontFamily: "Inter", color: "#333" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomColor: "#EEE" },
    labInfo: { flexDirection: "column", width: "45%", minWidth: 0 },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor },
    labDetails: { fontSize: 9, color: "#64748b", lineHeight: 1.3 },
    logoContainer: { width: "35%", alignItems: "flex-end", justifyContent: "flex-start" },
    logo: { width: 270, height: 75, objectFit: "contain" },
    patientBox: {
      backgroundColor: "#f8fafc",
      padding: 5,
      borderRadius: 4,
      flexDirection: "row",
      flexWrap: "wrap",
      borderWidth: 1,
      borderColor: primaryColor,
    },
    patientItemName: { width: "100%", marginBottom: 2 },
    patientItemData: { width: "60%", marginBottom: 2 },
    patientItem: { width: "40%", marginBottom: 2 },
    label: { fontWeight: "bold", color: "#475569" },
    categoryHeader: { backgroundColor: primaryColor, padding: 6, marginTop: 5, marginBottom: 0 },
    categoryHeaderText: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#ffffff",
      textTransform: "uppercase",
      letterSpacing: 1,
      textAlign: "center",
    },
    sectionHeader: { paddingVertical: 2, paddingHorizontal: 8, backgroundColor: "#e2e8f0" },
    sectionHeaderText: { fontWeight: "bold", color: "#0f172a" },
    tableHeader: {
      flexDirection: "row",
      borderBottom: 1.5,
      borderBottomColor: "#333",
      paddingTop: 6,
      paddingBottom: 4,
      backgroundColor: "#f1f5f9",
    },
    tableRow: {
      flexDirection: "row",
      borderBottom: 0.5,
      borderBottomColor: "#e2e8f0",
      paddingTop: 1,
      paddingBottom: 1,
    },
    colExam: { width: "35%", paddingLeft: 8 },
    colResult: { width: "20%", textAlign: "center" },
    colResultText: { width: "65%", paddingLeft: 4 },
    colUnit: { width: "15%", textAlign: "center" },
    colRange: { width: "30%", textAlign: "center", paddingRight: 4 },
    alertResult: { color: "#dc2626", fontWeight: "bold" },
    signatureSection: { position: "absolute",
      bottom: 30,
      left: 40,
      right: 40, marginTop: 24, paddingTop: 12, borderTop: 1, borderTopColor: "#e2e8f0" },
    signatureRow: { flexDirection: "row", gap: 5, justifyContent: "center" },
    signatureImage: { width: 150, height: 70, objectFit: "contain" },
    footer: {
      position: "absolute",
      bottom: 30,
      left: 40,
      right: 40,
      borderTop: 1,
      borderTopColor: "#EEE",
      paddingTop: 10,
      textAlign: "center",
      fontSize: 8,
      color: "#94a3b8",
    },
  });

  const departmentOrderMap = buildDepartmentOrderMap(departmentOrder);

  const sortedItems = [...orderItems].sort((a, b) => {
    const catA = a.category || "Pruebas Especiales";
    const catB = b.category || "Pruebas Especiales";
    if (catA !== catB) {
      const catAIndex = departmentOrderMap.get(catA) ?? Number.MAX_SAFE_INTEGER;
      const catBIndex = departmentOrderMap.get(catB) ?? Number.MAX_SAFE_INTEGER;

      if (catAIndex !== catBIndex) {
        return catAIndex - catBIndex;
      }

      return catA.localeCompare(catB);
    }
    return (a.resolved_sort_order || 0) - (b.resolved_sort_order || 0);
  });

  const grouped: Record<string, FlatRow[]> = {};

  for (const item of sortedItems) {
    const category = item.category || item.results_data?.category || "Pruebas Especiales";
    if (!grouped[category]) grouped[category] = [];

    const sections = item.results_data?.sections || [];
    const allFields: Array<{ label: string }> = sections.flatMap((section: any) => section.fields || []);
    const isMultiField = allFields.length > 1;

    for (const section of sections) {
      const sectionRows: FlatRow[] = [];

      if (section.name !== "") {
        sectionRows.push({
          fieldLabel: section.name,
          value: "",
          unit: "",
          rangeDisplay: "",
          isOutOfRange: false,
          isSectionHeader: true,
        });
      }

      for (const field of section.fields || []) {
        const { rangeDisplay, isOutOfRange, matchedRange } = getFieldResultMeta(field, patientGender, patientAge);
        const parsedValue = Number(String(field.value ?? "").replace(",", "."));
        const resultColor = Number.isFinite(parsedValue)
          ? getCategoryStyle(parsedValue, matchedRange)
          : "black";

        sectionRows.push({
          fieldLabel: isMultiField ? field.label : item.test_name,
          value: field.value || "........",
          unit: field.unit || "",
          rangeDisplay,
          isOutOfRange,
          resultColor,
          fieldType: field.type,
        });
      }

      // Verificar si hay al menos un campo no vacío en la sección
      const hasValidField = sectionRows.some(row => !row.isSectionHeader && row.value !== "........" && row.value !== "");

      if (hasValidField) {
        grouped[category].push(...sectionRows);
      }
    }
  }

  const categoryOrder = sortCategoriesByDepartmentOrder(Object.keys(grouped), departmentOrder);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.labInfo}>
            <Text style={styles.labName}>{lab.name}</Text>
            <Text style={styles.labDetails}>{lab.address}</Text>
            <Text style={styles.labDetails}>Tel: {lab.phone}</Text>
            <Text style={styles.labDetails}>Email: {lab.email}</Text>
          </View>
          {labData?.logo && (
            <View style={styles.logoContainer}>
              <Image src={labData.logo} style={styles.logo} />
            </View>
          )}
        </View>

        <View style={styles.patientBox}>
          <View style={styles.patientItemName}>
            <Text>
              <Text style={styles.label}>Paciente: </Text>
              {patientData.name}
            </Text>
          </View>
          <View style={styles.patientItemData}>
            <Text>
              <Text style={styles.label}>CI: </Text>
              {patientData.id}
            </Text>
          </View>
          <View style={styles.patientItem}>
            <Text>
              <Text style={styles.label}>Fecha de muestra: </Text>
              {format(new Date(orden.created_at), "dd/MM/yyyy")}
            </Text>
          </View>
          <View style={styles.patientItemData}>
            <Text>
              <Text style={styles.label}>Edad/Sexo: </Text>
              {patientData.age} / {patientData.gender}
            </Text>
          </View>
          <View style={styles.patientItem}>
            <Text>
              <Text style={styles.label}>No. Orden: </Text>
              {orden.order_seq.toString().padStart(4, "0")}
            </Text>
          </View>
        </View>

        {categoryOrder.map((category) => (
          <View key={category}>
            <View style={styles.categoryHeader} minPresenceAhead={24}>
              <Text style={styles.categoryHeaderText}>{category}</Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.colExam, { fontWeight: "bold" }]}>EXAMEN</Text>
              <Text style={[styles.colResult, { fontWeight: "bold" }]}>RESULTADO</Text>
              <Text style={[styles.colUnit, { fontWeight: "bold" }]}>UNIDADES</Text>
              <Text style={[styles.colRange, { fontWeight: "bold" }]}>VALORES DE REF.</Text>
            </View>

            {grouped[category].map((row, index) => {
              if (row.isSectionHeader) {
                return (
                  <View key={`${category}-${index}`} style={styles.tableRow}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>{row.fieldLabel}</Text>
                    </View>
                  </View>
                );
              }

              if (row.value === "........" || row.value === "") return null;

              if (row.fieldType === "text" || row.fieldType === "select") {
                return (
                  <View key={`${category}-${index}`} style={styles.tableRow}>
                    <Text style={styles.colExam}>{row.fieldLabel}</Text>
                    <Text style={styles.colResultText}>{row.value}</Text>
                  </View>
                );
              }

              return (
                <View key={`${category}-${index}`} style={styles.tableRow}>
                  <Text style={styles.colExam}>{row.fieldLabel}</Text>
                  <Text
                    style={[
                      styles.colResult,
                      { fontWeight: "bold", color: row.resultColor === "black" && row.isOutOfRange ? "#dc2626" : row.resultColor || "#000" },
                    ]}
                  >
                    {row.value}
                  </Text>
                  <Text style={styles.colUnit}>{row.unit || ""}</Text>
                  <Text style={styles.colRange}>{row.rangeDisplay || ""}</Text>
                </View>
              );
            })}
          </View>
        ))}

        {shouldRenderSignatureBlock(orden) && (
          <View style={styles.signatureSection}>
            <View style={styles.signatureRow}>
              <View>
                {orden.firma_url ? <Image src={orden.firma_url} style={styles.signatureImage} /> : null}
              </View>
              <View>
                {orden.sello_url ? <Image src={orden.sello_url} style={styles.signatureImage} /> : null}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Este reporte contiene los resultados de todos los examenes solicitados en la orden.
        </Text>
      </Page>
    </Document>
  );
};
