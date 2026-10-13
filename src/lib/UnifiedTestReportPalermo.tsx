import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { isMicrobiologyResult, type MicrobiologyResultsData } from '@/features/microbiology/types';
import { MicrobiologyReportSection } from './MicrobiologyReportSection';
import { getFieldResultMeta } from "@/features/tests/schemas";
import { getCategoryStyle } from "@/utils/validators";
import type { OrderRow } from "@/features/orders/schemas";
import { enhanceSignatureImage } from "./enhanceSignatureImage";

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter/static/Inter_18pt-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter/static/Inter_18pt-Bold.ttf", fontWeight: "bold" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

interface UnifiedProps {
  orden: OrderRow;
  orderItems: Array<Record<string, unknown>>;
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
    watermark?: string | null;
    primary_color?: string;
    report_footer_text?: string | null;
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



interface ReportChunk {
  category: string;
  rows: FlatRow[];
  startsNewPage: boolean;
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

function parseNumericResult(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const normalizedValue = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(normalizedValue)) return undefined;

  const numberValue = Number(normalizedValue.replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function formatNumericResult(value: unknown): string {
  const numericValue = parseNumericResult(value);
  if (numericValue === undefined) return String(value ?? "");

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 20,
  }).format(numericValue);
}

function estimateMicrobiologyHeight(row: FlatRow): number {
  // Estimate height for a MICRO_DATA block based on its content
  try {
    const data = JSON.parse(row.value) as {
      sample_type?: string;
      gram_stain?: string;
      culture_result?: string;
      isolated_germs?: string[];
      antibiogram?: Array<{ antibiotic_id: string; sensitivity?: string | null; sensitivities?: Record<number, string> }>;
    };
    let height = 0;
    height += 30; // "INFORME BACTERIOLÓGICO" title
    if (data.sample_type) height += 20; // MUESTRA line
    if (data.gram_stain) height += 20; // Gram line
    const germs = data.isolated_germs?.filter(Boolean) ??
      (data.culture_result ? data.culture_result.split("\n").filter(Boolean) : []);
    height += 14 + (germs.length > 0 ? germs.length * 14 : 0) + 10; // Cultivo block
    const abCount = (data.antibiogram || []).filter(ab => {
      if (ab.sensitivity && ab.sensitivity !== "") return true;
      if (ab.sensitivities) return Object.values(ab.sensitivities).some(v => v !== "");
      return false;
    }).length;
    const germCount = germs.length > 0 ? germs.length : 1;
    const rowsPerAb = 0.5; // all layouts use 2 antibiotics per row
    const tableRows = Math.ceil(abCount * rowsPerAb);
    if (abCount > 0) height += 30 + tableRows * 18; // ANTIBIOGRAMA title + rows
    return height + 30; // extra margin
  } catch {
    return 250; // safe fallback
  }
}

function estimateRowHeight(row: FlatRow): number {
  if (row.fieldLabel === "MICRO_DATA") return estimateMicrobiologyHeight(row);
  if (row.isSectionHeader) return 16;

  const valStr = String(row.value || "");
  const explicitLines = valStr.split("\n");
  const hasLabel = Boolean(row.fieldLabel && row.fieldLabel.trim());
  const valueCharsPerLine = row.hideTableHeader ? (hasLabel ? 42 : 55) : 38;
  let totalValueLines = 0;
  for (const line of explicitLines) {
    totalValueLines += Math.max(1, Math.ceil(line.length / valueCharsPerLine));
  }

  const labelCharsPerLine = row.hideTableHeader ? 18 : 26;
  const labelLines = Math.ceil((row.fieldLabel?.length || 0) / labelCharsPerLine);
  const rangeLines = Math.ceil((row.rangeDisplay?.length || 0) / 16);
  const lineCount = Math.max(1, labelLines, totalValueLines, rangeLines);

  return 14 * lineCount + (row.methodName ? 14 : 0) + 4;
}

function paginateCategories(
  categoryOrder: string[],
  grouped: Record<string, FlatRow[]>,
  availableHeight: number,
): ReportChunk[] {
  const chunks: ReportChunk[] = [];
  let remainingHeight = availableHeight;

  for (const category of categoryOrder) {
    const rows = grouped[category] || [];
    if (rows.length === 0) continue;
    let rowIndex = 0;

    while (rowIndex < rows.length) {
      const isCategoryContinuation = rowIndex > 0;
      const hideTableHeader = rows.every(r => r.hideTableHeader);
      const headerHeight = hideTableHeader ? 26 : 48;

      let firstRowHeight = estimateRowHeight(rows[rowIndex]);
      if (rows[rowIndex]?.isSectionHeader && rows[rowIndex + 1]) {
        firstRowHeight += estimateRowHeight(rows[rowIndex + 1]);
      }

      let shouldStartNewPage = isCategoryContinuation;

      if (!isCategoryContinuation && remainingHeight < headerHeight + firstRowHeight + 5) {
        remainingHeight = availableHeight;
        shouldStartNewPage = true;
      }

      if (chunks.length === 0) {
        shouldStartNewPage = false;
      }

      const chunkRows: FlatRow[] = [];
      let chunkHeight = headerHeight;

      while (rowIndex < rows.length) {
        const currentRow = rows[rowIndex];
        const pairedRow = currentRow.isSectionHeader ? rows[rowIndex + 1] : undefined;
        const rowHeight = pairedRow
          ? estimateRowHeight(currentRow) + estimateRowHeight(pairedRow)
          : estimateRowHeight(currentRow);

        if (chunkRows.length > 0 && chunkHeight + rowHeight > remainingHeight) {
          break;
        }

        chunkRows.push(currentRow);
        chunkHeight += estimateRowHeight(currentRow);
        rowIndex += 1;

        if (pairedRow) {
          chunkRows.push(pairedRow);
          chunkHeight += estimateRowHeight(pairedRow);
          rowIndex += 1;
        }
      }

      if (chunkRows.length > 1 && chunkRows[chunkRows.length - 1].isSectionHeader) {
        const lastRow = chunkRows.pop();
        if (lastRow) {
          chunkHeight -= estimateRowHeight(lastRow);
          rowIndex -= 1;
        }
      }

      chunks.push({
        category,
        rows: chunkRows,
        startsNewPage: shouldStartNewPage,
      });

      remainingHeight -= chunkHeight;

      if (rowIndex < rows.length) {
        remainingHeight = availableHeight;
      }
    }
  }

  return chunks;
}

export const UnifiedTestReportPalermo = ({ orden, orderItems, departmentOrder = [], patientData, labData }: UnifiedProps) => {
  const lab = labData || { name: "LABORATORIO CLINICO", address: "Av. Principal 123", phone: "555-0123", email: "" };
  const patientAge = parsePatientAge(patientData?.age);
  const patientGender = patientData?.gender;
  const primaryColor = labData?.primary_color || "#0ea5e9";

  console.log("Order Items (Rivalta):", orderItems);

  const hasSignature = shouldRenderSignatureBlock(orden);
  const firmaUrl = orden.firma_url;
  const selloUrl = orden.sello_url;
  const reservedBottomSpace = hasSignature ? 165 : 40;

  const styles = StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingLeft: 40,
      paddingRight: 40,
      paddingBottom: reservedBottomSpace,
      fontSize: 11,
      fontFamily: "Inter",
      color: "#000000",
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomColor: "#EEE"},
    labInfo: { flexDirection: "column", width: "55%", minWidth: 0 },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor },
    labDetails: { fontSize: 9, color: "black", lineHeight: 1.3 },
    logoContainer: { width: "35%", alignItems: "flex-end", justifyContent: "flex-start" },
    logo: { width: 185, height: 85, objectFit: "fill"},
    patientBox: {
      backgroundColor: "#f8fafc",
      padding: 5,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    patientItemName: { width: "100%", marginBottom: 2 },
    patientItemData: { width: "60%", marginBottom: 2 },
    patientItem: { width: "40%", marginBottom: 2 },
    label: {  color: "black" },
    categoryHeader: { backgroundColor: "#f8fafc", padding: 6, marginTop: 5, marginBottom: 0, borderColor: primaryColor, borderWidth: 1 },
    categoryHeaderText: {
      fontSize: 10,
      fontWeight: "heavy",
      color: primaryColor,
      textTransform: "uppercase",
      letterSpacing: 1,
      textAlign: "center",
    },
    sectionHeader: { paddingVertical: 2, paddingHorizontal: 8, backgroundColor: "#e2e8f0" },
    sectionHeaderText: { color: "#0f172a" },
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
    colResultText: { width: "65%", lineHeight: 1.1 },
    compactTextResult: { lineHeight: 0.8, paddingTop: 0, paddingBottom: 0 },
    colUnit: { width: "15%", textAlign: "center" },
    colRange: { width: "30%", textAlign: "center", paddingRight: 4 },
    alertResult: { color: "#dc2626" },
    signatureSection: {
      position: "absolute",
      bottom: 60,
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
    signatureImage: { width: 220, height: 90, objectFit: "contain" },
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
      bottom: 40,
      left: 40,
      right: 40,
      borderTop: 1,
      borderTopColor: "#EEE",
      paddingTop: 8,
      textAlign: "center",
      fontSize: 8,
      color: "#94a3b8",
    },
    watermark: {
      position: "absolute",
      top: "15%",
      left: "15%",
      width: "70%",
      height: "70%",
      opacity: 0.1,
      objectFit: "contain",
      zIndex: -1,
    }
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

    const category = item.category || resultsData?.category || item.test_templates?.category || "Pruebas Especiales";
    const isMicrobiology =
      isMicrobiologyResult(resultsData) ||
      item.test_templates?.result_type === "MICROBIOLOGY" ||
      resultsData?.result_type === "MICROBIOLOGY";

    if (isMicrobiology) {
      if (!grouped[category]) grouped[category] = [];
      const microData = {
        ...(isMicrobiologyResult(resultsData)
          ? resultsData
          : {
              result_type: "MICROBIOLOGY" as const,
              sample_type: resultsData?.sample_type || "",
              gram_stain: resultsData?.gram_stain || "",
              culture_result: resultsData?.culture_result || "",
              antibiogram: Array.isArray(resultsData?.antibiogram) ? resultsData.antibiogram : [],
            }),
        template_schema: item.template_schema,
      };

      grouped[category].push({
        fieldLabel: item.test_name,
        value: "MICROBIOLOGY_BLOCK",
        unit: "",
        rangeDisplay: "",
        isOutOfRange: false,
        isSectionHeader: true,
        hideTableHeader: true,
        methodName: undefined,
      });
      grouped[category].push({
        fieldLabel: "MICRO_DATA",
        value: JSON.stringify(microData),
        unit: "",
        rangeDisplay: "",
        isOutOfRange: false,
        hideTableHeader: true,
      });
      continue;
    }

    if (!grouped[category]) grouped[category] = [];

    const sections = resultsData?.sections || [];
    const allFields: Array<{ label: string }> = sections.flatMap((section: { fields?: Array<{ label: string }> }) => section.fields || []);
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
        const parsedValue = parseNumericResult(field.value);
        const resultColor = Number.isFinite(parsedValue)
          ? getCategoryStyle(parsedValue, matchedRange)
          : "black";

        sectionRows.push({
          fieldLabel: isMultiField ? field.label : item.test_name,
          value: field.value !== undefined && field.value !== null && String(field.value).trim() !== ""
            ? field.value
            : "........",
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
        grouped[category].push(
          ...sectionRows.filter(
            row => row.isSectionHeader || (row.value !== "........" && row.value !== ""),
          ),
        );
      }
    }
  }

  const categoryOrder = sortCategoriesByDepartmentOrder(Object.keys(grouped), departmentOrder);
  const availablePageHeight = 792 - 150 - reservedBottomSpace - 10;
  const reportChunks = paginateCategories(categoryOrder, grouped, availablePageHeight);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {labData?.watermark && (
          <Image src={labData.watermark} style={styles.watermark} fixed />
        )}
        <View style={styles.header} fixed>
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

        <View style={styles.patientBox} fixed>
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

        {reportChunks.map((chunk, chunkIndex) => {
          const hideTableHeader = chunk.rows.length > 0 && chunk.rows.every(r => r.hideTableHeader);

          return (
            <View key={`${chunk.category}-${chunkIndex}`} break={chunk.startsNewPage}>
              <View style={styles.categoryHeader} wrap={false} minPresenceAhead={60}>
                <Text style={styles.categoryHeaderText}>{chunk.category}</Text>
              </View>

              {!hideTableHeader && (
                <View style={styles.tableHeader} wrap={false}>
                  <Text style={[styles.colExam]}>EXAMEN</Text>
                  <Text style={[styles.colResult]}>RESULTADO</Text>
                  <Text style={[styles.colUnit]}>UNIDADES</Text>
                  <Text style={[styles.colRange]}>VALORES DE REF.</Text>
                </View>
              )}

              {chunk.rows.map((row, index) => {
                console.log(`Rendering row for category "${chunk.category}":`, row);

                if (row.isSectionHeader && row.value !== "MICROBIOLOGY_BLOCK") {
                  return (
                    <View key={`${chunk.category}-${chunkIndex}-${index}`} style={styles.tableRow} wrap={false}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>{row.fieldLabel}</Text>
                      </View>
                    </View>
                  );
                }

                if (row.value === "........" || row.value === "") return null;
                if (row.fieldLabel === "MICRO_DATA") {
                  try {
                    const microData = JSON.parse(row.value) as MicrobiologyResultsData;
                    return <MicrobiologyReportSection key={`${chunk.category}-${chunkIndex}-${index}`} data={microData} primaryColor={primaryColor} />;
                  } catch (e) {
                    return null;
                  }
                }
                
                if (row.value === "MICROBIOLOGY_BLOCK") return null;

                if (row.fieldType === "text" || row.fieldType === "select") {
                  if (row.hideTableHeader) {
                    const hasLabel = Boolean(row.fieldLabel && row.fieldLabel.trim());
                    return (
                      <View
                        key={`${chunk.category}-${chunkIndex}-${index}`}
                        style={[
                          styles.tableRow,
                          {
                            flexDirection: "row",
                            alignItems: "flex-start",
                            paddingLeft: 8,
                            paddingRight: 8,
                            paddingTop: 3,
                            paddingBottom: 3,
                          },
                        ]}
                        wrap={false}
                      >
                        {hasLabel ? (
                          <View style={{ maxWidth: "35%", marginRight: 10, flexShrink: 0 }}>
                            <Text style={{ fontWeight: "bold", fontSize: 11.5, color: "#0f172a" }}>
                              {row.fieldLabel}
                            </Text>
                            {row.methodName ? (
                              <Text style={{ fontSize: 8.5, color: "#64748b", marginTop: 2 }}>
                                <Text style={{ fontWeight: "bold" }}>Método:</Text> {row.methodName}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.compactTextResult, { width: "100%" }]}>
                            {row.value}
                          </Text>
                          {!hasLabel && row.methodName ? (
                            <Text style={{ fontSize: 8.5, color: "#64748b", marginTop: 2 }}>
                              <Text style={{ fontWeight: "bold" }}>Método:</Text> {row.methodName}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={`${chunk.category}-${chunkIndex}-${index}`} style={styles.tableRow} wrap={false}>
                      <View style={styles.colExam}>
                        <Text>{row.fieldLabel}</Text>
                        {row.methodName ? (
                          <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                            <Text style={{ fontWeight: "bold" }}>Método:</Text> {row.methodName}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.colResultText, styles.compactTextResult]}>{row.value}</Text>
                    </View>
                  );
                }

                return (
                  <View key={`${chunk.category}-${chunkIndex}-${index}`} style={styles.tableRow} wrap={false}>
                    <View style={styles.colExam}>
                      <Text>{row.fieldLabel}</Text>
                      {row.methodName ? (
                        <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                          <Text style={{ fontWeight: "bold" }}>Método:</Text> {row.methodName}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.colResult,
                        {
                          color: row.resultColor === "black" && row.isOutOfRange ? "#dc2626" : row.resultColor || "#000", textAlign: "center"
                        },
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
          );
        })}

        {shouldRenderSignatureBlock(orden) && (
          <View style={styles.signatureSection} fixed>
            <View style={styles.signatureImagesRow}>
              {firmaUrl ? <Image src={() => enhanceSignatureImage(firmaUrl)} style={styles.signatureImage} /> : null}
              {selloUrl ? <Image src={() => enhanceSignatureImage(selloUrl)} style={styles.signatureImage} /> : null}
            </View>
            <View style={styles.signatureTextContainer}>
              {(orden.signature_footer_text?.trim()
                ? orden.signature_footer_text
                : orden.firma_name
                ? ""
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

        {labData?.report_footer_text?.trim() && (
          <Text style={styles.footer} fixed>
            {labData.report_footer_text}
          </Text>
        )}
      </Page>
    </Document>
  );
};

