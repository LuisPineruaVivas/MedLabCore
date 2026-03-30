import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { TestTemplateRow, findMatchingRange, ReferenceRange, TemplateSection, TemplateField } from '@/features/tests/schemas';

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

type RenderField = TemplateField & { value?: string | number };

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
    id: "000-0000"
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
    page: { padding: 40, fontSize: 10, fontFamily: 'Inter', color: '#333' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottom: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
    labInfo: { flexDirection: 'column', maxWidth: '60%', flexShrink: 1 },
    labName: { fontSize: 12, fontWeight: 'bold', color: primaryColor },
    labDetails: { fontSize: 9, color: '#64748b', flexShrink: 1 },
    patientBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 4, flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
    patientItem: { width: '50%', marginBottom: 4 },
    label: { fontWeight: 'bold', color: '#475569' },
    categoryHeader: {
      backgroundColor: primaryColor,
      padding: 6,
      marginTop: 14,
      marginBottom: 0,
    },
    categoryHeaderText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionHeader: {
      marginTop: 10,
      paddingVertical: 4,
      paddingHorizontal: 6,
      backgroundColor: '#e2e8f0',
      borderRadius: 4,
      marginBottom: 2,
    },
    sectionHeaderText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#0f172a',
    },
    tableHeader: {
      flexDirection: 'row',
      borderBottom: 1.5,
      borderBottomColor: '#333',
      paddingTop: 6,
      paddingBottom: 4,
      backgroundColor: '#f1f5f9',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingTop: 5,
      paddingBottom: 5,
    },
    colExam: { width: '35%', paddingLeft: 4 },
    colResult: { width: '20%', textAlign: 'center' },
    colUnit: { width: '15%', textAlign: 'center' },
    colRange: { width: '30%', textAlign: 'right', paddingRight: 4 },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: 1, borderTopColor: '#EEE', paddingTop: 10, textAlign: 'center', fontSize: 8, color: '#94a3b8' },
    alertResult: { color: '#dc2626', fontWeight: 'bold' },
  });

  // Mostramos secciones y campos (con encabezado de sección si existe nombre)
  const wrapText = (value?: string, maxChars = 50): string => {
    if (!value) return '';
    const words = value.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      if (attempt.length <= maxChars) {
        current = attempt;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines.join('\n');
  };

  const sections = template.schema?.sections || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labInfo}>
            <Text style={styles.labName}>{lab.name}</Text>
            <Text style={styles.labDetails}>{wrapText(lab.address, 50)}</Text>
            <Text style={styles.labDetails}>Tel: {lab.phone}</Text>
            <Text style={styles.labDetails}>Email: {lab.email}</Text>
          </View>
          {labData?.logo && <Image src={labData.logo} style={{ width: 320, height: 75 }} />}
        </View>

        {/* Patient Info */}
        <View style={styles.patientBox}>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Paciente: </Text>{patient.name}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Fecha: </Text>{patient.date}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Edad/Sexo: </Text>{typeof patient.age === 'number' ? `${patient.age} Años` : patient.age} / {patient.gender}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Orden: </Text>{patient.id}</Text></View>
        </View>

        {/* Category header */}
        <View style={styles.categoryHeader}>
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
          <View key={section.id} wrap={false}>
            {section.name && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.name}</Text>
              </View>
            )}
            {(section.fields || []).map((field: RenderField) => {
              const matchedRange: ReferenceRange | undefined = findMatchingRange(
                field.reference_ranges,
                patientGender,
                patientAge
              );

              let rangeDisplay = '';
              if (matchedRange) {
                rangeDisplay = `${matchedRange.min_value} - ${matchedRange.max_value}`;
              } else if (field.range) {
                rangeDisplay = field.range;
              }

              const resultValue = field.value != null && field.value !== '' ? parseFloat(String(field.value)) : null;
              const isOutOfRange = !!(matchedRange && resultValue != null && !isNaN(resultValue) && (
                resultValue < matchedRange.min_value || resultValue > matchedRange.max_value
              ));

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
                  <Text style={styles.colUnit}>{field.unit || '-'}</Text>
                  <Text style={styles.colRange}>{rangeDisplay || '-'}</Text>
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
