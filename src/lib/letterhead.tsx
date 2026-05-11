import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { OrderRow } from '@/features/orders/schemas';

interface PatientData {
  name: string;
  id: string;
  date: string;
  age: string | number;
  gender: string;
}

interface UnifiedProps {
  orden: OrderRow;
  patientData: PatientData;
}

export const LetterHeadPDF = ({ orden, patientData }: UnifiedProps) => {
  const orderNumber = orden?.order_seq ?? orden?.id ?? 'N/A';
  const orderDate = patientData?.date || (orden?.created_at ? new Date(orden.created_at).toLocaleDateString('es-VE') : 'N/A');

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 12,
      color: '#111',
      position: 'relative',
    },
    contentBox: {
      position: 'absolute',
      top: 370,
      left: 60,
      right: 80,
      minHeight: 140,
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
      textAlign: 'left',
    },
    label: {
      fontSize: 12,
      color: '#1f2937',
      textAlign: 'left',
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.contentBox}>

          <View style={styles.row}>
            <Text style={styles.label}><Text style={{ fontWeight: 'bold' }}>Paciente:</Text> {patientData.name}</Text>
            <Text style={styles.label}><Text style={{ fontWeight: 'bold' }}>Orden #:</Text> {orderNumber.toString().padStart(4, "0")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}><Text style={{ fontWeight: 'bold' }}>Cédula:</Text> {patientData.id}</Text>
            <Text style={styles.label}><Text style={{ fontWeight: 'bold' }}>Fecha:</Text> {orderDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}><Text style={{ fontWeight: 'bold' }}>Edad:</Text> {patientData.age}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
