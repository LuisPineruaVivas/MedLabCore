import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { getFieldResultMeta } from '@/features/tests/schemas';
import { OrderRow } from '@/features/orders/schemas';
import { format } from 'date-fns';

Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter/Inter-VariableFont_opsz,wght.ttf' }
  ],
});

interface UnifiedProps {
  orden: OrderRow;
  orderItems;
  patientData;
  labData?;
}

/** Flatten all order items into a flat list of rows grouped by category */
interface FlatRow {
  testName: string;
  fieldLabel: string;
  value: string;
  unit: string;
  rangeDisplay: string;
  isOutOfRange: boolean;
  isSectionHeader?: boolean;
  fieldType?: string;
}

export const UnifiedTestReportPDF = ({ orden, orderItems, patientData, labData }: UnifiedProps) => {
  const lab = labData || { name: "LABORATORIO CLÍNICO", address: "Av. Principal 123", phone: "555-0123" };

  const patientAge: number | undefined = typeof patientData?.age === 'number'
    ? patientData.age
    : typeof patientData?.age === 'string'
      ? parseInt(patientData.age, 10) || undefined
      : undefined;
  const patientGender: string | undefined = patientData?.gender;

  const primaryColor = labData?.primary_color || '#0ea5e9';

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Inter', color: '#333' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
    labInfo: { flexDirection: 'column', width: '45%', minWidth: 0 },
    labName: { fontSize: 12, fontWeight: 'bold', color: primaryColor },
    labDetails: { fontSize: 9, color: '#64748b', lineHeight: 1.3 },
    logoContainer: { width: '35%', alignItems: 'flex-end', justifyContent: 'flex-start' },
    logo: { width: 270, height: 75, objectFit: 'contain' },
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
      paddingVertical: 4,
      paddingHorizontal: 6,
      backgroundColor: '#e2e8f0',
      borderRadius: 4,
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
    colResutlText: { width: '65%', paddingLeft: 4 },
    colUnit: { width: '15%', textAlign: 'center' },
    colRange: { width: '30%', textAlign: 'center', paddingRight: 4 },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: 1, borderTopColor: '#EEE', paddingTop: 10, textAlign: 'center', fontSize: 8, color: '#94a3b8' },
    alertResult: { color: '#dc2626', fontWeight: 'bold' },
  });

  const sortedItems = [...orderItems].sort((a, b) => {
    // Primero por categoría (para que se agrupen bien)
    const catA = a.category || "Otros";
    const catB = b.category || "Otros";
    if (catA !== catB) return catA.localeCompare(catB);

    // Segundo por el orden resuelto que inyectamos en el hook
    return (a.resolved_sort_order || 0) - (b.resolved_sort_order || 0);
  });

  // ── Flatten all items into rows grouped by category ──────
  const grouped: Record<string, FlatRow[]> = {};

  for (const item of sortedItems) {
    const cat = item.category || item.results_data?.category || 'Otros';
    if (!grouped[cat]) grouped[cat] = [];

    const sections = item.results_data?.sections || [];
    // Check if this test has multiple fields across all sections
    const allFields: [] = sections.flatMap((s) => s.fields || []);
    const isMultiField = allFields.length > 1;

    for (const section of sections) {
      if (section.name !== '') {
        // If section has a name, add it as a separate row spanning all columns
        grouped[cat].push({
          testName: item.test_name,
          fieldLabel: section.name,
          value: '',
          unit: '',
          rangeDisplay: '',
          isOutOfRange: false,
          isSectionHeader: true
        })
      }
      for (const field of section.fields || []) {
        const { rangeDisplay, isOutOfRange } = getFieldResultMeta(
          field,
          patientGender,
          patientAge
        );

        // For single-field tests, use test_name as the label; for multi-field, use field label
        const displayLabel = isMultiField ? field.label : item.test_name;

        grouped[cat].push({
          testName: item.test_name,
          fieldLabel: displayLabel,
          value: field.value || '........',
          unit: field.unit || '',
          rangeDisplay,
          isOutOfRange,
          isSectionHeader: false,
          fieldType: field.type
        });
      }
    }
  }

  const categoryOrder = Object.keys(grouped).sort();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Lab Header */}
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
          <View style={styles.patientItem}><Text><Text style={styles.label}>Paciente: </Text>{patientData.name}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>CI: </Text>{patientData.id}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Fecha De Muestra: </Text>{format(new Date(orden.created_at), "dd/MM/yyyy")}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Edad/Sexo: </Text>{patientData.age} / {patientData.gender}</Text></View>
          <View style={styles.patientItem}><Text><Text style={styles.label}>Nº Orden: </Text>{orden.order_seq.toString().padStart(4, '0')}</Text></View>
        </View>

        {/* ── Render grouped by category ─────────────────── */}
        {categoryOrder.map((category) => (
          <View key={category}>
            {/* Single category header */}
            <View style={styles.categoryHeader} minPresenceAhead={24}>
              <Text style={styles.categoryHeaderText}>{category}</Text>
            </View>

            {/* Single table header per category */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colExam, { fontWeight: 'bold' }]}>EXAMEN</Text>
              <Text style={[styles.colResult, { fontWeight: 'bold' }]}>RESULTADO</Text>
              <Text style={[styles.colUnit, { fontWeight: 'bold' }]}>UNIDADES</Text>
              <Text style={[styles.colRange, { fontWeight: 'bold' }]}>VALORES DE REF.</Text>
            </View>

            {/* All rows for this category */}
            {grouped[category].map((row, idx) => {
              return(
              row.isSectionHeader ?
                <View key={`${category}-${idx}`} style={styles.tableRow}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{row.fieldLabel}</Text>
                  </View>
                </View>
                  :
                  row.value === "........" ? null : row.fieldType === "text" || row.fieldType === "select"  ?
                   <View key={`${category}-${idx}`} style={styles.tableRow}>
                    <Text style={[
                      styles.colExam,
                      { fontWeight: row.isSectionHeader ? 'bold' : 'normal' }
                      ]}>
                      {row.fieldLabel}
                    </Text>
                    <Text style={styles.colResutlText}>
                      {row.value}
                    </Text>

                  </View>
                  : 
                  <View key={`${category}-${idx}`} style={styles.tableRow}>
                    <Text style={[
                      styles.colExam,
                      { fontWeight: row.isSectionHeader ? 'bold' : 'normal' }
                    ]}>
                      {row.fieldLabel}
                    </Text>
                    <Text style={[
                      styles.colResult,
                      { fontWeight: 'bold' },
                      row.isOutOfRange ? styles.alertResult : {},
                    ]}>
                      {row.value}
                    </Text>
                    <Text style={styles.colUnit}>{row.unit || ''}</Text>
                    <Text style={styles.colRange}>{row.rangeDisplay || ''}</Text>
                  </View>
)
            })}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Este reporte contiene los resultados de todos los exámenes solicitados en la orden.
        </Text>
      </Page>
    </Document>
  );
};
