import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { OrderWithPatient } from "@/features/orders/schemas";
import { PhoneIcon } from "lucide-react";

const noHyphenation = (word: string) => [word];

interface AttendanceCertificatePDFProps {
  order: OrderWithPatient;
  labData?: {
    name?: string;
    address?: string;
    logo?: string | null;
    rif?: string | null;
    phone?: string | null;
    lab_admin?: string | null;
    ciudad?: string | null;
  };
  subjectName?: string;
  subjectDocumentId?: string;
}

export function CompanionAttendanceCertificatePDF({
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
  const labCity = labData?.ciudad?.trim() || "Actual";
  const issueDayName = format(issueDate, "eeee", { locale: es });
  const issueDay = format(issueDate, "dd");
  const issueMonth = format(issueDate, "MMMM", { locale: es });
  const issueYear = format(issueDate, "yyyy");

  const styles = StyleSheet.create({
    page: {
      paddingTop: 32,
      paddingHorizontal: 48,
      paddingBottom: 64,
      fontSize: 12,
      color: "#111827",
      position: "relative",
    },
    header: {
      alignItems: "center",
      marginBottom: 26,
    },
    infoHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 26,
        position: "absolute",
        top: 120,
        left: 190,
        right: 48,
        width: 350
    },
    logo: {
      width: 600,
      height: 110,
      objectFit: "contain",
    },
    labInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: "center",
    },
    labrif: {
        fontSize: 14,
        lineHeight: 1.4,
        textTransform: "uppercase",
        left: 0,
    },
    labPhone: {
        fontSize: 8,
        lineHeight: 1.4,
        textTransform: "uppercase",
        textAlign: "center",
    },
    labDetail: {
      fontSize: 8,
      lineHeight: 1.4,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 26,
      marginBottom: 28,
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "center",
      letterSpacing: 1.5,
    },
    body: {
      width: "100%",
      paddingHorizontal: 8,
    },
    paragraph: {      
      fontSize: 12,
      lineHeight: 1.6,
      textAlign: "justify",
      marginBottom: 20,
    },
    bold: {
      fontWeight: "bold",
    },
    footer: {
      position: "absolute",
      left: 48,
      right: 48,
      bottom: 300,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 1.6,
    },
    footerLine: {
      width: "70%",
      height: 1,
      backgroundColor: "#111827",
      marginBottom: 8,
      alignSelf: "center",
    },
  });

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          {labData?.logo ? <Image src={labData.logo} style={styles.logo} /> : null}
        </View>

        <View style={styles.infoHeader}>
          <View style={styles.labInfo}>
            {labData?.rif ? <Text style={styles.labrif}>RIF: {labData.rif}</Text> : null}
            {labData?.address ? <Text style={styles.labDetail}>{labData.address.slice(0, 78)}</Text> : null}
            {labData?.phone ? <Text style={styles.labPhone}><PhoneIcon /> TELF: {labData.phone}</Text> : null}
          </View>
        </View>

        <Text style={styles.title}>CONSTANCIA</Text>

        <View style={styles.body}>
          <Text style={styles.paragraph} hyphenationCallback={noHyphenation}>
            Quien suscribe, Lcda. <Text style={styles.bold}>{labData?.lab_admin}</Text>, jefe del "<Text style={styles.bold}>{labName}</Text>", hace 
            constar que el/la ciudadano <Text style={styles.bold}>{certificateName}</Text>; titular de la cedula de 
            identidad <Text style={styles.bold}>V-{documentId}</Text>, asistió al laboratorio como acompañante 
            del ciudadano <Text style={styles.bold}>{patientName}</Text> a las {format(issueDate, "hh:mm aa")}.
          </Text>

          <Text style={styles.paragraph} hyphenationCallback={noHyphenation}>
            Constancia que se expide en la ciudad de <Text style={styles.bold}>{labData?.ciudad}</Text> el 
            dia <Text style={styles.bold}> {issueDayName.toUpperCase()} {issueDay}</Text> de <Text style={styles.bold}>{issueMonth.toUpperCase()}</Text> del <Text style={styles.bold}>{issueYear}</Text>.
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
