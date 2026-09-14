import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { TestTemplateRow, getFieldResultMeta, TemplateSection, TemplateField, FieldType } from '@/features/tests/schemas';

Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter/Inter-VariableFont_opsz,wght.ttf' }
  ],
});

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

type RenderField = TemplateField & { value?: string | number; type: FieldType };

export interface TestTemplateReportProps {
  template: TestTemplateRow;
  labData?: PdfLabData;
  patientData?: PdfPatientData;
}

export const TestReportRivaltaPDF = ({ template, labData, patientData }: TestTemplateReportProps) => {
  const defaultPatient = {
    name: "PACIENTE DE PRUEBA",
    age: 30,
    gender: "Masculino",
    date: new Date().toLocaleDateString("es-ES"),
    id: "14822455"
  };

  const patient = patientData || defaultPatient;
  const lab = labData || { name: "LABORATORIO CLÍNICO", address: "Av. Principal 123", phone: "555-0123" };
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
      paddingBottom: 145,
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
    label: { fontWeight: "bold", color: "#475569" },
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
    compactTextResult: { lineHeight: 0.8, paddingTop: 0, paddingBottom: 0 },
    colUnit: { width: "15%", textAlign: "center" },
    colRange: { width: "30%", textAlign: "center", paddingRight: 4 },
    alertResult: { color: "#dc2626", fontWeight: "bold" },
    signatureSection: {
      position: "absolute",
      bottom: 50,
      left: 40,
      right: 40,
      paddingTop: 8,
      borderTop: 1,
      borderTopColor: "#e2e8f0",
    },
    signatureRow: { flexDirection: "row", gap: 5, justifyContent: "center" },
    signatureImage: { width: 150, height: 70, objectFit: "contain" },
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

  const sections = template.schema?.sections || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
              <Text style={styles.label}>Fecha: </Text>
              {patient.date}
            </Text>
          </View>
          <View style={styles.patientItemData}>
            <Text>
              <Text style={styles.label}>Edad/Sexo: </Text>
              {typeof patient.age === 'number' ? `${patient.age} Años` : patient.age} / {patient.gender}
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
            <Text style={[styles.colExam, { fontWeight: 'bold' }]}>EXAMEN</Text>
            <Text style={[styles.colResult, { fontWeight: 'bold' }]}>RESULTADO</Text>
            <Text style={[styles.colUnit, { fontWeight: 'bold' }]}>UNIDADES</Text>
            <Text style={[styles.colRange, { fontWeight: 'bold' }]}>VALORES DE REF.</Text>
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
              const { rangeDisplay, isOutOfRange } = getFieldResultMeta(
                field,
                patientGender,
                patientAge
              );

              const hasExplicitValue = field.value !== undefined && field.value !== null && field.value !== '';
              const sampleValue = hasExplicitValue
                ? String(field.value)
                : (field.options && field.options.length > 0 ? field.options[0] : '........');

              if (field.type === 'text' || field.type === 'select') {
                return (
                  <View key={field.id} style={styles.tableRow} wrap={false}>
                    <Text style={styles.colExam}>{field.label}</Text>
                    <Text style={[styles.colResultText, styles.compactTextResult]}>{sampleValue}</Text>
                  </View>
                );
              }

              return (
                <View key={field.id} style={styles.tableRow}>
                  <Text style={styles.colExam}>{field.label}</Text>
                  <Text style={[
                    styles.colResult,
                    { fontWeight: 'bold' },
                    isOutOfRange ? styles.alertResult : {},
                  ]}>
                    {sampleValue}
                  </Text>
                  <Text style={styles.colUnit}>{field.unit || ''}</Text>
                  <Text style={styles.colRange}>{rangeDisplay || ''}</Text>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.footer}>Documento generado de vista previa</Text>
      </Page>
    </Document>
  );
};
