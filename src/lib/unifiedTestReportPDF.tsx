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
  hideTableHeader?: boolean;
  methodName?: string;
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

function parsePatientAge(age: string | number | undefined): number | undefined {
  if (typeof age === "number") return Number.isFinite(age) ? age : undefined;
  if (typeof age !== "string") return undefined;

  const match = age.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mes(?:es)?|a(?:ñ|n)o(?:s)?)?/i);
  if (!match) return undefined;

  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return undefined;

  return match[2]?.toLowerCase().startsWith("mes") ? value / 12 : value;
}

export const UnifiedTestReportPDF = ({ orden, orderItems, departmentOrder = [], patientData, labData }: UnifiedProps) => {
  const lab = labData || { name: "LABORATORIO CLINICO", address: "Av. Principal 123", phone: "555-0123", email: "" };
  const patientAge = parsePatientAge(patientData?.age);
  const patientGender = patientData?.gender;
  const primaryColor = labData?.primary_color || "#0ea5e9";

  console.log("Order Items:", orderItems);

  const styles = StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingLeft: 40,
      paddingRight: 40,
      paddingBottom: 145,
      fontSize: 11,
      fontFamily: "Inter",
      color: "#333",
    },
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
    colResult: { width: "20%", textAlign: "left" },
    colResultText: { width: "65%", lineHeight: 1.1 },
    compactTextResult: { lineHeight: 0.75, paddingTop: 0, paddingBottom: 0 },
    colUnit: { width: "15%", textAlign: "center" },
    colRange: { width: "30%", textAlign: "center", paddingRight: 4 },
    alertResult: { color: "#dc2626", fontWeight: "bold" },
    signatureSection: {
      position: "absolute",
      bottom: 35,
      left: 40,
      right: 40,
      alignItems: "center",
    },
    signatureImagesRow: {
      flexDirection: "row",
      gap: 15,
      justifyContent: "center",
      alignItems: "flex-end",
      marginBottom: 3,
    },
    signatureImage: { maxWidth: 140, height: 60, objectFit: "contain" },
    signatureLine: {
      width: 220,
      borderTopWidth: 1,
      borderTopColor: "#334155",
      marginTop: 2,
      marginBottom: 4,
    },
    signatureTextContainer: {
      alignItems: "center",
    },
    signatureFooterLine: {
      fontSize: 8.5,
      fontFamily: "Inter",
      color: "#1e293b",
      textAlign: "center",
      lineHeight: 1.2,
    },
    footer: {
      position: "absolute",
      bottom: 25,
      left: 40,
      right: 40,
      borderTop: 1,
      borderTopColor: "#EEE",
      paddingTop: 8,
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
    const resultsData = typeof item.results_data === "string" ? JSON.parse(item.results_data || "{}") : (item.results_data || {});
    const templateSchema = typeof item.test_templates?.schema === "string" ? JSON.parse(item.test_templates.schema || "{}") : (item.test_templates?.schema || {});

    const category = item.category || resultsData?.category || "Pruebas Especiales";
    if (!grouped[category]) grouped[category] = [];

    const sections = resultsData?.sections || [];
    const allFields: Array<{ label: string }> = sections.flatMap((section: any) => section.fields || []);
    const isMultiField = allFields.length > 1;
    const hideTableHeader = Boolean(resultsData?.hide_table_header ?? templateSchema?.hide_table_header);
    const methodName = typeof item.method_name === "string" ? item.method_name.trim() : "";
    let methodRendered = false;

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
          hideTableHeader,
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
          hideTableHeader,
          methodName: methodRendered ? undefined : methodName || undefined,
        });
        methodRendered = true;
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

        {categoryOrder.map((category) => {
          const rows = grouped[category] || [];
          if (rows.length === 0) return null;
          const hideTableHeader = rows.length > 0 && rows.every(r => r.hideTableHeader);

          return (
          <View key={category}>
            <View style={styles.categoryHeader} wrap={false} minPresenceAhead={80}>
              <Text style={styles.categoryHeaderText}>{category}</Text>
            </View>

            {!hideTableHeader && (
              <View style={styles.tableHeader} wrap={false}>
                <Text style={[styles.colExam, { fontWeight: "bold" }]}>EXAMEN</Text>
                <Text style={[styles.colResult, { fontWeight: "bold" }]}>RESULTADO</Text>
                <Text style={[styles.colUnit, { fontWeight: "bold" }]}>UNIDADES</Text>
                <Text style={[styles.colRange, { fontWeight: "bold" }]}>VALORES DE REF.</Text>
              </View>
            )}

            {grouped[category].map((row, index) => {
              if (row.isSectionHeader) {
                return (
                  <View key={`${category}-${index}`} style={styles.tableRow} wrap={false}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>{row.fieldLabel}</Text>
                    </View>
                  </View>
                );
              }

              if (row.value === "........" || row.value === "") return null;

              if (row.fieldType === "text" || row.fieldType === "select") {
                if (row.hideTableHeader) {
                  return (
                    <View key={`${category}-${index}`} style={[styles.tableRow, { flexDirection: "column", paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }]} wrap={false}>
                      {row.fieldLabel ? (
                        <Text style={{ fontWeight: "bold", fontSize: 10, marginBottom: 2 }}>
                          {row.fieldLabel}
                        </Text>
                      ) : null}
                      <Text style={[styles.compactTextResult, { width: "100%", paddingLeft: row.fieldLabel ? 16 : 0 }]}>
                        {row.value}
                      </Text>
                      {row.methodName ? (
                        <Text style={[styles.compactTextResult, { width: "100%", paddingLeft: row.fieldLabel ? 16 : 0, paddingTop: 4 }]}>
                          Método: {row.methodName}
                        </Text>
                      ) : null}
                    </View>
                  );
                }

                return (
                  <View key={`${category}-${index}`} style={styles.tableRow} wrap={false}>
                    <View style={styles.colExam}>
                      <Text>{row.fieldLabel}</Text>
                      {row.methodName ? (
                        <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                          Método: {row.methodName}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.colResultText, styles.compactTextResult]}>{row.value}</Text>
                  </View>
                );
              }

              return (
                <View key={`${category}-${index}`} style={styles.tableRow} wrap={false}>
                  <View style={styles.colExam}>
                    <Text>{row.fieldLabel}</Text>
                    {row.methodName ? (
                      <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                        Método: {row.methodName}
                      </Text>
                    ) : null}
                  </View>
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
          )
})}

        {shouldRenderSignatureBlock(orden) && (
          <View style={styles.signatureSection} fixed>
            <View style={styles.signatureImagesRow}>
              {orden.firma_url ? <Image src={orden.firma_url} style={styles.signatureImage} /> : null}
              {orden.sello_url ? <Image src={orden.sello_url} style={styles.signatureImage} /> : null}
            </View>
            <View style={styles.signatureLine} />
            <View style={styles.signatureTextContainer}>
              {(orden.signature_footer_text?.trim()
                ? orden.signature_footer_text
                : orden.firma_name
                ? `Lic. ${orden.firma_name}`
                : ""
              )
                .split("\n")
                .map((line, idx) => (
                  <Text key={idx} style={styles.signatureFooterLine}>
                    {line}
                  </Text>
                ))}
            </View>
          </View>
        )}

        {/*<Text style={styles.footer} fixed>
          Este reporte contiene los resultados de todos los examenes solicitados en la orden.
        </Text>*/}
      </Page>
    </Document>
  );
};
