import {
  type MicrobiologyFieldDef,
  type MicrobiologyResultsData,
  getMicrobiologyFields,
} from "@/features/microbiology/types";

export type MicrobiologyPreviewData = MicrobiologyResultsData & {
  template_schema?: { microbiology_fields?: MicrobiologyFieldDef[] } | null;
};

export function createMicrobiologyPreviewData(
  templateSchema?: { microbiology_fields?: MicrobiologyFieldDef[] } | null
): MicrobiologyPreviewData {
  const extraFields = Object.fromEntries(
    getMicrobiologyFields(templateSchema)
      .filter((field) => !["sample_type", "gram_stain", "culture_result"].includes(field.key))
      .map((field, index) => [field.key, `Dato de ejemplo ${index + 1}`])
  );

  return {
    result_type: "MICROBIOLOGY",
    sample_type: "Urocultivo",
    gram_stain: "Bacilos gram negativos",
    culture_mode: "germs",
    culture_result: "Escherichia coli\nKlebsiella pneumoniae",
    isolated_germs: ["Escherichia coli", "Klebsiella pneumoniae"],
    extra_fields: extraFields,
    antibiogram: [
      { antibiotic_id: "preview-ampicillin", antibiotic_name: "Ampicilina", sensitivity: "R", sensitivities: { 0: "R", 1: "R" } },
      { antibiotic_id: "preview-ceftriaxone", antibiotic_name: "Ceftriaxona", sensitivity: "S", sensitivities: { 0: "S", 1: "I" } },
      { antibiotic_id: "preview-ciprofloxacin", antibiotic_name: "Ciprofloxacina", sensitivity: "S", sensitivities: { 0: "S", 1: "S" } },
      { antibiotic_id: "preview-gentamicin", antibiotic_name: "Gentamicina", sensitivity: "I", sensitivities: { 0: "I", 1: "S" } },
    ],
    template_schema: templateSchema,
  };
}
