import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

interface BudgetItem {
  test_name: string;
  price: number;
}

interface BudgetProps {
  budgetDate: string;
  patientName: string;
  patientId: string;
  items: BudgetItem[];
  total: number;
  exchangeRate?: number | null;
  totalBs?: number | null;
  notes?: string | null;
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
  };
}

export const OrderBudgetPDF = ({
  budgetDate,
  patientName,
  patientId,
  items,
  total,
  labData,
  exchangeRate,
  totalBs,
  notes,
}: BudgetProps) => {
  const lab = labData || { name: "LABORATORIO CLÍNICO", address: "", phone: "", email: "" };
  const primaryColor = lab.primary_color || '#0ea5e9';

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#333' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    labInfo: { flexDirection: 'column', width: '55%', minWidth: 0 },
    labName: { fontSize: 12, fontWeight: 'bold', color: primaryColor, marginBottom: 2 },
    labDetails: { fontSize: 9, color: '#64748b', lineHeight: 1.3 },
    logoContainer: { width: '40%', alignItems: 'flex-end', justifyContent: 'flex-start' },
    logo: { width: 220, height: 65, objectFit: 'contain' },

    receiptTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 3,
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    receiptSubtitle: { fontSize: 9, textAlign: 'center', color: '#94a3b8', marginBottom: 16 },

    infoRow: {
      flexDirection: 'row',
      justify: 'space-between',
      marginBottom: 16,
      backgroundColor: '#f8fafc',
      padding: 10,
      borderRadius: 4,
    },
    infoBlock: { flexDirection: 'column' },
    infoLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
    infoValue: { fontSize: 10, fontWeight: 'bold', color: '#1e293b' },

    tableHeader: { flexDirection: 'row', borderBottom: 1, borderBottomColor: '#334155', paddingBottom: 6, marginBottom: 4 },
    tableHeaderText: { fontSize: 9, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottom: 1, borderBottomColor: '#f1f5f9' },

    totalRow: {
      flexDirection: 'row',
      justify: 'flex-end',
      marginTop: 10,
      paddingTop: 10,
      borderTop: 2,
      borderTopColor: primaryColor,
    },
    totalLabel: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginRight: 20 },
    totalValue: { fontSize: 14, fontWeight: 'bold', color: primaryColor },

    noticeBox: {
      marginTop: 24,
      padding: 12,
      backgroundColor: '#fffbeb',
      borderRadius: 4,
      borderLeft: 3,
      borderLeftColor: '#f59e0b',
    },
    noticeTitle: { fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 4 },
    noticeText: { fontSize: 8, color: '#78716c', lineHeight: 1.5 },

    notesBox: {
      marginTop: 8,
      marginBottom: 16,
      padding: 10,
      backgroundColor: '#f8fafc',
      borderRadius: 4,
      borderLeft: 3,
      borderLeftColor: primaryColor,
    },
    notesTitle: { fontSize: 8, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
    notesText: { fontSize: 9, color: '#1e293b' },

    footer: {
      position: 'absolute',
      bottom: 30,
      left: 40,
      right: 40,
      borderTop: 1,
      borderTopColor: '#e2e8f0',
      paddingTop: 8,
      textAlign: 'center',
      fontSize: 8,
      color: '#94a3b8',
    },
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header - Identical layout & styling to UnifiedTestReportPDF */}
        <View style={styles.header}>
          <View style={styles.labInfo}>
            <Text style={styles.labName}>{lab.name}</Text>
            {lab.address && <Text style={styles.labDetails}>{lab.address}</Text>}
            {lab.phone && <Text style={styles.labDetails}>Tel: {lab.phone}</Text>}
            {lab.email && <Text style={styles.labDetails}>Email: {lab.email}</Text>}
          </View>
          {lab.logo && (
            <View style={styles.logoContainer}>
              <Image src={lab.logo} style={styles.logo} />
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.receiptTitle}>Presupuesto</Text>
        <Text style={styles.receiptSubtitle}>Cotización de exámenes de laboratorio</Text>

        {/* Patient & Budget Info */}
        <View style={styles.infoRow}>
          <View style={{ width: '100%', marginBottom: 8 }}>
            <Text style={styles.infoLabel}>Paciente</Text>
            <Text style={styles.infoValue}>{patientName}</Text>
          </View>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={[styles.infoBlock, { width: '40%' }]}>
              <Text style={styles.infoLabel}>Cédula / ID</Text>
              <Text style={styles.infoValue}>{patientId}</Text>
            </View>
            <View style={[styles.infoBlock, { width: '35%' }]}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>{budgetDate}</Text>
            </View>
            <View style={[styles.infoBlock, { width: '25%' }]}>
              <Text style={styles.infoLabel}>Validez</Text>
              <Text style={styles.infoValue}>15 Días</Text>
            </View>
          </View>
        </View>

        {/* Notes if present */}
        {notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Observaciones / Notas</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {/* Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { width: '10%' }]}>#</Text>
          <Text style={[styles.tableHeaderText, { width: '50%' }]}>Examen</Text>
          <Text style={[styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>USD</Text>
          {exchangeRate && <Text style={[styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>BS</Text>}
        </View>

        {items.map((item, idx) => (
          <View key={`${item.test_name}-${idx}`} style={styles.tableRow}>
            <Text style={{ width: '10%', fontSize: 10, color: '#94a3b8' }}>{idx + 1}</Text>
            <Text style={{ width: '50%', fontSize: 10 }}>{item.test_name}</Text>
            <Text style={{ width: '20%', fontSize: 10, textAlign: 'right', fontWeight: 'bold' }}>
              ${item.price.toFixed(2)}
            </Text>
            {exchangeRate && (
              <Text style={{ width: '20%', fontSize: 10, textAlign: 'right', fontWeight: 'bold' }}>
                Bs. {(item.price * exchangeRate).toFixed(2)}
              </Text>
            )}
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 10, paddingTop: 10, borderTop: 2, borderTopColor: primaryColor, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginRight: 15, textAlign: 'right' }}>
              TOTAL USD
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: primaryColor, minWidth: 90, textAlign: 'right' }}>
              ${total.toFixed(2)}
            </Text>
          </View>

          {exchangeRate && totalBs != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: '#475569', marginRight: 15, textAlign: 'right' }}>
                TOTAL BS (Tasa: {exchangeRate.toFixed(2)})
              </Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b', minWidth: 90, textAlign: 'right' }}>
                Bs. {totalBs.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>CONDICIONES DEL PRESUPUESTO</Text>
          <Text style={styles.noticeText}>
            • Este presupuesto es una estimación de costos y tiene una validez de 15 días continuos a partir de su emisión.{'\n'}
            • Los precios están sujetos a cambios sin previo aviso tras el vencimiento de su validez.{'\n'}
            • Este comprobante no es un documento fiscal.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {lab.name}
        </Text>
      </Page>
    </Document>
  );
};
