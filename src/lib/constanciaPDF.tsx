import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { OrderWithPatient } from "@/features/orders/schemas";

const noHyphenation = (word: string) => [word];

interface AttendanceCertificatePDFProps {
  order: OrderWithPatient;
  labData?: {
    name?: string;
    address?: string;
    logo?: string | null;
  };
  subjectName?: string;
  subjectDocumentId?: string;
}

export function AttendanceCertificatePDF({
  order,
  labData,
  subjectName,
  subjectDocumentId,
}: AttendanceCertificatePDFProps) {
  const issueDate = order?.created_at ? new Date(order.created_at) : new Date();
  const patientName = `${order.patients.first_name} ${order.patients.last_name}`.trim().toUpperCase();
  const documentId = (subjectDocumentId || order.patients.id_number || "").trim();
  const certificateName = (subjectName || patientName).trim().toUpperCase();
  const labName = labData?.name?.trim() || "LABORATORIO";
  const labAddress = labData?.address?.trim() || "la sede del laboratorio";
  const issueDay = format(issueDate, "dd");
  const issueMonth = format(issueDate, "MMMM", { locale: es });
  const issueYear = format(issueDate, "yyyy");

  const styles = StyleSheet.create({
    page: {
      paddingTop: 56,
      paddingHorizontal: 56,
      paddingBottom: 72,
      fontSize: 12,
      color: "#111827",
      position: "relative",
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    logo: {
      width: 350,
      height: 75,
      objectFit: "contain",
      marginBottom: 8,
    },
    title: {
      marginTop: 22,
      marginBottom: 30,
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
      letterSpacing: 1.2,
    },
    body: {
      width: "100%",
      paddingHorizontal: 18,
    },
    paragraph: {
      fontSize: 11,
      lineHeight: 1.8,
      textAlign: "justify",
      marginBottom: 24,
    },
    footer: {
      position: "absolute",
      left: 56,
      right: 56,
      bottom: 300,
      textAlign: "center",
      fontSize: 12,
    },
    footerLine: {
      width: "70%",
      height: 1,
      backgroundColor: "#111827",
      marginBottom: 8,
      alignSelf: "center",
    }
  });

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          {labData?.logo ? <Image src={labData.logo} style={styles.logo} /> : null}
        </View>

        <Text style={styles.title}>CONSTANCIA</Text>

        <View style={styles.body}>
          <Text style={styles.paragraph} hyphenationCallback={noHyphenation}>
            {"     "}Mediante la presente se hace constar, que el/la Paciente: <Text style={{ fontWeight: "bold" }}>{certificateName}</Text> Identificado(a) con el Documento de
            Identidad <Text style={{ fontWeight: "bold" }}>V-{documentId}</Text> Se presento al <Text style={{ fontWeight: "bold", textTransform: "uppercase" }}>{labName}</Text> a realizarse examenes de Laboratorio.
          </Text>

          <Text style={styles.paragraph} hyphenationCallback={noHyphenation}>
            {"     "}Constancia que se expide a peticion de parte interesada, de lo antes mencionado se firma en la <Text style={{ fontWeight: "bold" }}>{labAddress}</Text>
            {" "}A los {issueDay} dias del mes de {issueMonth} de {issueYear}.
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text>Atentamente</Text>
        </View>
      </Page>
    </Document>
  );
}
