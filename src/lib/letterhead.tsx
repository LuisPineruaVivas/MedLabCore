import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { OrderRow } from '@/features/orders/schemas';
import { T } from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js';

Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter/Inter-VariableFont_opsz,wght.ttf' }
  ],
});

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
      fontSize: 10,
      fontFamily: 'Inter',
      color: '#111',
      position: 'relative',
    },
    contentBox: {
      position: 'absolute',
      top: 370,
      left: 170,
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
      fontSize: 10,
      fontWeight: 'bold',
      color: '#1f2937',
      textAlign: 'left',
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.contentBox}>

          <View style={styles.row}>
            <Text style={styles.label}>Paciente: {patientData.name}</Text>
            <Text style={styles.label}>Orden #: {orderNumber.toString().padStart(4, "0")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cédula: {patientData.id}</Text>
            <Text style={styles.label}>Fecha: {orderDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Edad: {patientData.age}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Género: {patientData.gender} </Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};
