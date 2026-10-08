import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { TestTemplateRow, getFieldResultMeta, TemplateSection, TemplateField, FieldType } from '@/features/tests/schemas';
import { getCategoryStyle } from "@/utils/validators";

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter/static/Inter_18pt-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Inter/static/Inter_18pt-Bold.ttf", fontWeight: "bold" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

interface PdfLabData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string | null;
  primary_color?: string;
  secondary_color?: string;
}

interface PdfPatientData {
  name?: string;
  age?: number | string;
  gender?: string;
  date?: string;
  id?: string;
}

type RenderField = TemplateField & { value?: string | number; type: FieldType; method_name?: string };

export interface TestTemplateReportProps {
  template: TestTemplateRow;
  labData?: PdfLabData;
  patientData?: PdfPatientData;
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

  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 20 }).format(numericValue);
}

export const TestReportPalermoPDF = ({ template, labData, patientData }: TestTemplateReportProps) => {
  const defaultPatient = {
    name: "PACIENTE DE PRUEBA",
    age: 30,
    gender: "Masculino",
    date: new Date().toLocaleDateString("es-ES"),
    id: "14822455"
  };

  const patient = patientData || defaultPatient;
  const lab = labData || { name: "LABORATORIO CLINICO", address: "Av. Principal 123", phone: "555-0123", email: "" };
  const primaryColor = labData?.primary_color || '#0ea5e9';

  const patientAge: number | undefined = typeof patient.age === 'number'
    ? patient.age
    : typeof patient.age === 'string'
    ? parseInt(patient.age, 10) || undefined
    : undefined;
  const patientGender: string | undefined = patient.gender;

  const styles = StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingLeft: 40,
      paddingRight: 40,
      paddingBottom: 40,
      fontSize: 11,
      fontFamily: "Inter",
      color: "#333",
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomColor: "#EEE" },
    labInfo: { flexDirection: "column", width: "45%", minWidth: 0 },
    labName: { fontSize: 12, fontWeight: "bold", color: primaryColor },
    labDetails: { fontSize: 9, color: "#64748b", lineHeight: 1.3 },
    logoContainer: { width: "35%", alignItems: "flex-end", justifyContent: "flex-start" },
    logo: { width: 185, height: 85, objectFit: "fill" },
    patientBox: {
      backgroundColor: "#f8fafc",
      padding: 5,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    patientItemName: { width: "100%", marginBottom: 2 },
    patientItemData: { width: "60%", marginBottom: 2 },
    patientItem: { width: "40%", marginBottom: 2 },
    label: { color: "#475569" },
    categoryHeader: {
      backgroundColor: "#f8fafc",
      padding: 6,
      marginTop: 5,
      marginBottom: 0,
      borderColor: primaryColor,
      borderWidth: 1,
    },
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
    alertResult: { color: "#dc2626"},
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
      bottom: 15,
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

  const sections = template.schema?.sections || [];
  const templateMethodName = typeof (template as any).method_name === "string" ? (template as any).method_name.trim() : "";
  let methodRendered = false;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
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

        {/* Patient Info with Rivalta Layout */}
        <View style={styles.patientBox}>
          <View style={styles.patientItemName}>
            <Text>
              <Text style={styles.label}>Paciente: </Text>
              {patient.name}
            </Text>
          </View>
          <View style={styles.patientItemData}>
            <Text>
              <Text style={styles.label}>CI: </Text>
              {patient.id}
            </Text>
          </View>
          <View style={styles.patientItem}>
            <Text>
              <Text style={styles.label}>Fecha de muestra: </Text>
              {patient.date}
            </Text>
          </View>
          <View style={styles.patientItemData}>
            <Text>
              <Text style={styles.label}>Edad/Sexo: </Text>
              {typeof patient.age === 'number' ? `${patient.age}` : patient.age} / {patient.gender}
            </Text>
          </View>
          <View style={styles.patientItem}>
            <Text>
              <Text style={styles.label}>No. Orden: </Text>
              00001
            </Text>
          </View>
        </View>

        {/* Category header */}
        <View style={styles.categoryHeader} minPresenceAhead={24}>
          <Text style={styles.categoryHeaderText}>{template.category || template.name}</Text>
        </View>

        {/* Table header */}
        {!template.schema?.hide_table_header && (
          <View style={styles.tableHeader}>
            <Text style={[styles.colExam]}>EXAMEN</Text>
            <Text style={[styles.colResult]}>RESULTADO</Text>
            <Text style={[styles.colUnit]}>UNIDADES</Text>
            <Text style={[styles.colRange]}>VALORES DE REF.</Text>
          </View>
        )}

        {/* Sections & Fields */}
        {sections.map((section: TemplateSection) => (
          <View key={section.id}>
            {section.name === '' ? null : (
              <View style={styles.tableRow}>
                <View style={styles.sectionHeader} minPresenceAhead={18}>
                  <Text style={styles.sectionHeaderText}>{section.name}</Text>
                </View>
              </View>
            )}
            {(section.fields || []).map((field: RenderField) => {
              const { rangeDisplay, isOutOfRange, matchedRange } = getFieldResultMeta(
                field,
                patientGender,
                patientAge
              );

              const hasExplicitValue = field.value !== undefined && field.value !== null && field.value !== '';
              const rawValue = hasExplicitValue
                ? String(field.value)
                : (field.options && field.options.length > 0 ? field.options[0] : '........');

              const sampleValue = hasExplicitValue || rawValue !== '........'
                ? formatNumericResult(rawValue)
                : '........';

              const parsedValue = parseNumericResult(rawValue);
              const resultColor = Number.isFinite(parsedValue)
                ? getCategoryStyle(parsedValue, matchedRange)
                : "black";

              const fieldMethodName = field.method_name || (!methodRendered ? templateMethodName : undefined);
              if (fieldMethodName) methodRendered = true;

              if (field.type === 'text' || field.type === 'select') {
                if (template.schema?.hide_table_header) {
                  return (
                    <View key={field.id} style={[styles.tableRow, { flexDirection: "column", alignItems: "flex-start", paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }]} wrap={false}>
                      {field.label ? (
                        <Text style={{ fontSize: 10, marginBottom: 2 }}>{field.label}</Text>
                      ) : null}
                      <Text style={[styles.compactTextResult, { width: "100%", paddingLeft: field.label ? 16 : 0 }]}>
                        {sampleValue}
                      </Text>
                      {fieldMethodName ? (
                        <Text style={[styles.compactTextResult, { width: "100%", paddingLeft: field.label ? 16 : 0, paddingTop: 4 }]}>
                          <Text style={{ fontWeight: "bold" }}>Método:</Text> {fieldMethodName}
                        </Text>
                      ) : null}
                    </View>
                  );
                }

                return (
                  <View key={field.id} style={styles.tableRow} wrap={false}>
                    <View style={styles.colExam}>
                      <Text>{field.label}</Text>
                      {fieldMethodName ? (
                        <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                          <Text style={{ fontWeight: "bold" }}>Método:</Text> {fieldMethodName}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.colResultText, styles.compactTextResult]}>{sampleValue}</Text>
                  </View>
                );
              }

              return (
                <View key={field.id} style={styles.tableRow} wrap={false}>
                  <View style={styles.colExam}>
                    <Text>{field.label}</Text>
                    {fieldMethodName ? (
                      <Text style={{ paddingLeft: 6, paddingTop: 3 }}>
                        <Text style={{ fontWeight: "bold" }}>Método:</Text> {fieldMethodName}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.colResult,
                      {
                        color: resultColor === "black" && isOutOfRange ? "#dc2626" : resultColor || "#000",
                        textAlign: "center"
                      },
                    ]}
                  >
                    {sampleValue}
                  </Text>
                  <Text style={styles.colUnit}>{field.unit || ''}</Text>
                  <Text style={styles.colRange}>{rangeDisplay || ''}</Text>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.footer}>
          BIOANALISTA/BIOANALYST: LCDA. ROSWITA FUREK DE VILLASMIL COLG.N°18-0221-6825LCDA.ANGELA BEATO COLG N°18-0208-5523
        </Text>
      </Page>
    </Document>
  );
};
