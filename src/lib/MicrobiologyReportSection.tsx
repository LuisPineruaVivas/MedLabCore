import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { 
  type MicrobiologyResultsData, 
  type MicrobiologyFieldDef, 
  getGermSensitivity, 
  getMicrobiologyFields 
} from "@/features/microbiology/types";

interface MicrobiologyReportSectionProps {
  data: MicrobiologyResultsData & {
    template_schema?: { microbiology_fields?: MicrobiologyFieldDef[] } | null;
  };
  primaryColor?: string;
}

export const MicrobiologyReportSection = ({ data }: MicrobiologyReportSectionProps) => {
  const styles = StyleSheet.create({
    container: {
      marginTop: 15,
      marginBottom: 15,
    },
    title: {
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "center",
      textDecoration: "underline",
      marginBottom: 12,
      color: "#333",
    },
    sampleType: {
      fontSize: 10,
      fontWeight: "bold",
      marginBottom: 10,
    },
    textBlock: {
      marginBottom: 12,
      fontSize: 10,
      lineHeight: 1.4,
    },
    boldLabel: {
      fontWeight: "bold",
      textDecoration: "underline",
    },
    boldLabelNoUnderline: {
      fontWeight: "bold",
    },
    antibiogramTitle: {
      fontSize: 11,
      fontWeight: "bold",
      textAlign: "center",
      textDecoration: "underline",
      marginTop: 10,
      marginBottom: 8,
    },
    tableGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderTop: "1px solid #ccc",
      borderLeft: "1px solid #ccc",
    },
    tableCell: {
      borderRight: "1px solid #ccc",
      borderBottom: "1px solid #ccc",
      padding: 3,
      justifyContent: "center",
    },
    // Styles for 1 germ (split 2 antibiotics per row)
    cellAbName1: {
      width: "35%",
      backgroundColor: "#f9f9f9",
      fontSize: 9,
    },
    cellResult1: {
      width: "15%",
      alignItems: "center",
      fontSize: 9,
      fontWeight: "bold",
    },
    // Styles for 2 germs (split 2 antibiotics per row, matching Rivalta format)
    cellAbName2: {
      width: "30%",
      backgroundColor: "#f9f9f9",
      fontSize: 8.5,
    },
    cellResult2: {
      width: "10%",
      alignItems: "center",
      fontSize: 8.5,
      fontWeight: "bold",
    },
    // Styles for 3 germs (2 antibiotics per row, compact S/R columns)
    // Layout: [name 25%][G1 8.33%][G2 8.33%][G3 8.33%] × 2 = 100%
    cellAbName3: {
      width: "25%",
      backgroundColor: "#f9f9f9",
      fontSize: 8,
    },
    cellResult3: {
      width: "8.33%",
      alignItems: "center",
      fontSize: 8,
      fontWeight: "bold",
    },
  });

  const fieldDefs = getMicrobiologyFields(data.template_schema);
  const FIXED_KEYS = new Set(["sample_type", "gram_stain", "culture_result"]);

  const cultureFieldDef = fieldDefs.find(f => f.key === "culture_result");
  const cultureLabel = cultureFieldDef?.label || "Cultivo";

  const germs = data.isolated_germs && data.isolated_germs.length > 0
    ? data.isolated_germs.map(g => g.trim()).filter(Boolean)
    : [];

  const isGermsMode = data.culture_mode === "germs" || germs.length > 0;
  const germCount = germs.length > 0 ? germs.length : 1;

  // Filter antibiotics that have at least 1 sensitivity assigned for any germ
  const validAntibiotics = isGermsMode ? (data.antibiogram || []).filter((ab) => {
    for (let i = 0; i < germCount; i++) {
      const sens = getGermSensitivity(ab, i);
      if (sens && sens !== "") return true;
    }
    return false;
  }) : [];

  // Prepare renderable list (pad for 2-column layout for all germ counts)
  const renderableAntibiotics = [...validAntibiotics];
  if (renderableAntibiotics.length % 2 !== 0) {
    renderableAntibiotics.push({
      antibiotic_id: "empty",
      antibiotic_name: "",
      sensitivity: null,
      sensitivities: {},
    });
  }

  return (
    <View style={styles.container} minPresenceAhead={80}>
      <Text style={styles.title}>INFORME BACTERIOLÓGICO</Text>
      
      {/* Render dynamic fields configured in template (fixed + custom extras) */}
      {fieldDefs.map((fd) => {
        if (fd.key === "sample_type" && data.sample_type) {
          const sampleLabel = (fd.label || "MUESTRA").toUpperCase();
          return (
            <Text key={fd.id} style={styles.sampleType}>
              {sampleLabel}: <Text style={{ fontWeight: "normal" }}>{data.sample_type.toUpperCase()}</Text>
            </Text>
          );
        }

        if (fd.key === "gram_stain" && data.gram_stain) {
          return (
            <View key={fd.id} style={styles.textBlock}>
              <Text>
                <Text style={styles.boldLabel}>{fd.label || "Gram"}</Text>
                <Text style={styles.boldLabelNoUnderline}>: </Text>
                {data.gram_stain}
              </Text>
            </View>
          );
        }

        if (!FIXED_KEYS.has(fd.key)) {
          const extraValue = data.extra_fields?.[fd.key];
          if (!extraValue) return null;
          return (
            <View key={fd.id} style={styles.textBlock}>
              <Text>
                <Text style={styles.boldLabel}>{fd.label || "Campo adicional"}</Text>
                <Text style={styles.boldLabelNoUnderline}>: </Text>
                {extraValue}
              </Text>
            </View>
          );
        }

        return null;
      })}

      {/* Render Culture Result (Germs mode vs Free-text negative mode) */}
      {isGermsMode && germs.length > 0 ? (
        <View style={styles.textBlock}>
          <Text style={styles.boldLabelNoUnderline}>{cultureLabel}: Germen(es) Aislado(s): </Text>
          {germs.map((germ, index) => (
            <Text key={index} style={{ marginLeft: germs.length > 1 ? 10 : 0 }}>
              {germs.length > 1 ? `${index + 1}.- ` : ""}{germ}
            </Text>
          ))}
        </View>
      ) : data.culture_result ? (
        <View style={styles.textBlock}>
          <Text>
            <Text style={styles.boldLabel}>{cultureLabel}</Text>
            <Text style={styles.boldLabelNoUnderline}>: </Text>
            {data.culture_result}
          </Text>
        </View>
      ) : null}

      {isGermsMode && validAntibiotics.length > 0 && (
        <View>
          <Text style={styles.antibiogramTitle}>ANTIBIOGRAMA</Text>
          
          <View style={styles.tableGrid}>
            {germCount <= 1 ? (
              // 1 Germ layout: 2 antibiotics per row
              renderableAntibiotics.map((ab, index) => {
                const sens = getGermSensitivity(ab, 0);
                return (
                  <React.Fragment key={ab.antibiotic_id + index}>
                    <View style={[styles.tableCell, styles.cellAbName1]}>
                      <Text>{ab.antibiotic_name}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult1]}>
                      <Text>{sens || ""}</Text>
                    </View>
                  </React.Fragment>
                );
              })
            ) : germCount === 2 ? (
              // 2 Germs layout (Rivalta style): 2 antibiotics per row, each with G1 and G2 columns
              renderableAntibiotics.map((ab, index) => {
                const sens1 = getGermSensitivity(ab, 0);
                const sens2 = getGermSensitivity(ab, 1);
                return (
                  <React.Fragment key={ab.antibiotic_id + index}>
                    <View style={[styles.tableCell, styles.cellAbName2]}>
                      <Text>{ab.antibiotic_name}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult2]}>
                      <Text>{sens1 || ""}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult2]}>
                      <Text>{sens2 || ""}</Text>
                    </View>
                  </React.Fragment>
                );
              })
            ) : (
              // 3 Germs layout: 2 antibiotics per row, each with G1, G2, G3 compact columns
              renderableAntibiotics.map((ab, index) => {
                const sens1 = getGermSensitivity(ab, 0);
                const sens2 = getGermSensitivity(ab, 1);
                const sens3 = getGermSensitivity(ab, 2);
                return (
                  <React.Fragment key={ab.antibiotic_id + index}>
                    <View style={[styles.tableCell, styles.cellAbName3]}>
                      <Text>{ab.antibiotic_name}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult3]}>
                      <Text>{sens1 || ""}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult3]}>
                      <Text>{sens2 || ""}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellResult3]}>
                      <Text>{sens3 || ""}</Text>
                    </View>
                  </React.Fragment>
                );
              })
            )}
          </View>
        </View>
      )}
    </View>
  );
};
