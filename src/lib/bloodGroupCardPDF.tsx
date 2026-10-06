import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const noHyphenation = (word: string) => [word];

// Card physical dimensions: 8.5 cm x 5.5 cm
// 1 cm = 28.3465 pt
// 8.5 cm = 240.945 pt ≈ 241 pt
// 5.5 cm = 155.906 pt ≈ 156 pt
const CARD_WIDTH = 241;
const CARD_HEIGHT = 156;

// Letter page: 8.5 in x 11 in = 612 pt x 792 pt
// Margin from edges for the card (≈ 1 cm = ~28pt)
const CARD_MARGIN = 28;

export interface BloodGroupCardData {
  patientName: string;
  idNumber?: string;
  dateOfBirth?: string;
  bloodGroup: string;
  rhFactor: string;
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    rif?: string;
    city?: string;
    state?: string;
    logo?: string | null;
    primary_color?: string;
  };
  bioanalystData?: {
    name?: string;
    signatureUrl?: string | null;
    stampUrl?: string | null;
    footerText?: string | null;
  };
}

export function BloodGroupCardPDF({
  patientName,
  idNumber,
  dateOfBirth,
  bloodGroup,
  rhFactor,
  labData,
  bioanalystData,
}: BloodGroupCardData) {
  const brandColor = labData?.primary_color || "#1e3a8a";
  const cleanIdNumber = (idNumber || "").trim();
  const hasIdNumber = cleanIdNumber.length > 0;
  const cleanDob = (dateOfBirth || "").trim();
  const hasDob = cleanDob.length > 0;

  const styles = StyleSheet.create({
    // Letter page — full size so printing at 100% works correctly
    page: {
      width: 612,
      height: 792,
      backgroundColor: "#ffffff",
      fontFamily: "Helvetica",
    },
    // Card placed absolutely in the top-left corner
    cardWrapper: {
      position: "absolute",
      top: CARD_MARGIN,
      left: CARD_MARGIN,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
    cardBorder: {
      borderWidth: 1.5,
      borderColor: brandColor,
      borderRadius: 4,
      padding: 6,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundColor: "#ffffff",
    },
    // ── Header ──────────────────────────────────────────────────
    headerContainer: {
      alignItems: "center",
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Bold",
      color: brandColor,
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    headerAddress: {
      fontSize: 5,
      color: "#475569",
      textAlign: "center",
      marginTop: 1,
    },
    headerRifRow: {
      fontSize: 5,
      color: "#334155",
      textAlign: "center",
      marginTop: 1,
    },
    headerDivider: {
      borderBottomWidth: 0.8,
      borderBottomColor: brandColor,
      marginBottom: 4,
    },
    // ── Body fields ─────────────────────────────────────────────
    bodyContainer: {
      flex: 1,
      justifyContent: "center",
    },
    fieldRow: {
      borderBottomWidth: 0.8,
      borderBottomColor: brandColor,
      paddingBottom: 2,
      marginBottom: 4,
      flexDirection: "row",
      alignItems: "flex-end",
    },
    fieldLabel: {
      fontSize: 6,
      fontFamily: "Helvetica-Bold",
      color: brandColor,
    },
    fieldValue: {
      fontSize: 6.5,
      fontFamily: "Helvetica-Bold",
      color: "#0f172a",
      marginLeft: 4,
      textTransform: "uppercase",
      flex: 1,
    },
    // Two-column row for blood data
    bloodDataRow: {
      borderBottomWidth: 0.8,
      borderBottomColor: brandColor,
      paddingBottom: 2,
      marginBottom: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    bloodGroupCell: {
      flexDirection: "row",
      alignItems: "center",
    },
    rhFactorCell: {
      flexDirection: "row",
      alignItems: "center",
    },
    bloodValue: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: "#b91c1c",
      marginLeft: 3,
    },
    // ── Footer / Signature ───────────────────────────────────────
    footerSection: {
      alignItems: "flex-end",
    },
    signatureBlock: {
      width: "52%",
      alignItems: "center",
    },
    signatureImagesRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-end",
      marginBottom: 2,
      minHeight: 16,
    },
    assetImage: {
      maxHeight: 16,
      maxWidth: 40,
      objectFit: "contain",
      marginLeft: 3,
    },
    signatureLine: {
      width: "100%",
      borderBottomWidth: 0.8,
      borderBottomColor: brandColor,
      marginBottom: 2,
    },
    signatureTitle: {
      fontSize: 5,
      fontFamily: "Helvetica-Bold",
      color: brandColor,
      textAlign: "center",
      textTransform: "uppercase",
    },
    signatureFooterText: {
      fontSize: 4.5,
      color: "#334155",
      textAlign: "center",
      marginTop: 1,
    },
  });

  const rifText = labData?.rif ? `RIF: ${labData.rif}` : "";
  const phone = labData?.phone ? `Tel: ${labData.phone}` : "";
  const locationText = [rifText, phone].filter(Boolean).join("   ");

  return (
    <Document title={`Tarjeta Grupo Sanguineo - ${patientName}`}>
      {/*
        Full Letter page — when user prints at 100% ("Tamaño real") the card
        will appear exactly 8.5 cm × 5.5 cm anchored to the top-left margin.
        No print settings required from the user.
      */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.cardWrapper}>
          <View style={styles.cardBorder}>

            {/* ── Encabezado ─────────────────────────── */}
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle} hyphenationCallback={noHyphenation}>
                {labData?.name || "LABORATORIO CLÍNICO"}
              </Text>
              {labData?.address && (
                <Text style={styles.headerAddress} hyphenationCallback={noHyphenation}>
                  {labData.address}
                </Text>
              )}
              {locationText ? (
                <Text style={styles.headerRifRow} hyphenationCallback={noHyphenation}>
                  {locationText}
                </Text>
              ) : null}
            </View>

            {/* ── Cuerpo ─────────────────────────────── */}
            <View style={styles.bodyContainer}>
              {/* Nombre */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>NOMBRE:</Text>
                <Text style={styles.fieldValue} hyphenationCallback={noHyphenation}>
                  {patientName}
                </Text>
              </View>

              {/* C.I. — omitir completamente si está vacío */}
              {hasIdNumber && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>C.I. No:</Text>
                  <Text style={styles.fieldValue} hyphenationCallback={noHyphenation}>
                    {cleanIdNumber}
                  </Text>
                </View>
              )}

              {/* Fecha de Nacimiento — omitir si está vacía */}
              {hasDob && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>FECHA NACIMIENTO:</Text>
                  <Text style={styles.fieldValue} hyphenationCallback={noHyphenation}>
                    {cleanDob}
                  </Text>
                </View>
              )}

              {/* Grupo Sanguíneo | Factor RH */}
              <View style={styles.bloodDataRow}>
                <View style={styles.bloodGroupCell}>
                  <Text style={styles.fieldLabel}>GRUPO SANGUÍNEO:</Text>
                  <Text style={styles.bloodValue}>{bloodGroup}</Text>
                </View>
                <View style={styles.rhFactorCell}>
                  <Text style={styles.fieldLabel}>FACTOR RH:</Text>
                  <Text style={styles.bloodValue}>{rhFactor}</Text>
                </View>
              </View>
            </View>

            {/* ── Pie / Firma ────────────────────────── */}
            <View style={styles.footerSection}>
              <View style={styles.signatureBlock}>
                {(bioanalystData?.signatureUrl || bioanalystData?.stampUrl) && (
                  <View style={styles.signatureImagesRow}>
                    {bioanalystData?.signatureUrl && (
                      <Image src={bioanalystData.signatureUrl} style={styles.assetImage} />
                    )}
                    {bioanalystData?.stampUrl && (
                      <Image src={bioanalystData.stampUrl} style={styles.assetImage} />
                    )}
                  </View>
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureTitle} hyphenationCallback={noHyphenation}>
                  BIOANALISTA
                </Text>
                {bioanalystData?.name && (
                  <Text style={styles.signatureFooterText} hyphenationCallback={noHyphenation}>
                    {bioanalystData.name}
                  </Text>
                )}
              </View>
            </View>

          </View>
        </View>
      </Page>
    </Document>
  );
}
