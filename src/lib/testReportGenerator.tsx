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
  logo?: string;
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

interface Props {
  template: TestTemplateRow;
  labData?: PdfLabData;
  patientData?: PdfPatientData;
}

export const TestReportPDF = ({ template, labData, patientData }: Props) => {
  const defaultPatient = {
    name: "PACIENTE DE PRUEBA",
    age: 30,
    gender: "Masculino",
    date: new Date().toLocaleDateString(),
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
    page: { padding: 40, fontSize: 9, fontFamily: "Inter", color: "#333" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomColor: "#EEE" },
    labInfo: { flexDirection: 'column', width: '45%', minWidth: 0 },
    labName: { fontSize: 12, fontWeight: 'bold', color: primaryColor },
    labDetails: { fontSize: 9, color: '#64748b', lineHeight: 1.3 },
    logoContainer: { width: '35%', alignItems: 'flex-end', justifyContent: 'flex-start' },
    logo: { width: 270, height: 75, objectFit: 'contain' },
    patientBox: {
      backgroundColor: "#f8fafc",
      padding: 5,
      borderRadius: 4,
      flexDirection: "row",
      flexWrap: "wrap",
      borderWidth: 1,
      borderColor: primaryColor,
    },
    patientItem: { width: "50%", marginBottom: 2 },
    label: { fontWeight: 'bold', color: '#475569' },
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
    sectionHeaderText: { fontSize: 9, fontWeight: "bold", color: "#0f172a" },
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
    colResult: { width: '20%', textAlign: 'center' },
    colUnit: { width: '15%', textAlign: 'center' },
    colRange: { width: '30%', textAlign: 'right', paddingRight: 4 },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: 1, borderTopColor: '#EEE', paddingTop: 10, textAlign: 'center', fontSize: 8, color: '#94a3b8' },
    alertResult: { color: '#dc2626', fontWeight: 'bold' },
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

        {/* Patient Info */}
        <View style={styles.patientBox}>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Paciente: </Text>{patient.name}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>CI: </Text>{patient.id}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Fecha: </Text>{patient.date}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Edad/Sexo: </Text>{typeof patient.age === 'number' ? `${patient.age} Años` : patient.age} / {patient.gender}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Orden: </Text>{patient.id}</Text></View>
        </View>

        {/* Category header */}
        <View style={styles.categoryHeader} minPresenceAhead={24}>
          <Text style={styles.categoryHeaderText}>{template.category || template.name}</Text>
        </View>

        {/* Single table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colExam, { fontWeight: 'bold' }]}>EXAMEN</Text>
          <Text style={[styles.colResult, { fontWeight: 'bold' }]}>RESULTADO</Text>
          <Text style={[styles.colUnit, { fontWeight: 'bold' }]}>UNIDADES</Text>
          <Text style={[styles.colRange, { fontWeight: 'bold' }]}>VALORES DE REF.</Text>
        </View>

        {/* Secciones con encabezado + campos */}
        {sections.map((section: TemplateSection) => (
          <View key={section.id}>
            {section.name === '' ?
              null
              :
              <View style={styles.sectionHeader} minPresenceAhead={18}>
                <Text style={styles.sectionHeaderText}>{section.name}</Text>
              </View>
            }
            {(section.fields || []).map((field: RenderField) => {
              const { rangeDisplay, isOutOfRange } = getFieldResultMeta(
                field,
                patientGender,
                patientAge
              );

              return (
                <View key={field.id} style={styles.tableRow}>
                  <Text style={styles.colExam}>{field.label}</Text>
                  <Text style={[
                    styles.colResult,
                    { fontWeight: 'bold' },
                    isOutOfRange ? styles.alertResult : {},
                  ]}>
                    {field.value && field.value !== '' ? field.value : '........'}
                  </Text>
                  <Text style={styles.colUnit}>{field.unit || ''}</Text>
                  <Text style={styles.colRange}>{rangeDisplay || ''}</Text>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.footer}>Documento</Text>
      </Page>
    </Document>
  );
};
