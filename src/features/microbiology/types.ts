export type SensitivityValue = "S" | "I" | "R" | null | "";

export interface AntibiogramEntry {
  antibiotic_id: string;
  antibiotic_name: string;
  sensitivity?: SensitivityValue;
  sensitivities?: Record<number, SensitivityValue>;
}

/**
 * Defines a configurable field in a MICROBIOLOGY template.
 * - `key`: internal identifier used to store the value in results_data.
 * - `label`: the display name shown in the form and PDF report (editable by the lab).
 * - `fixed`: if true, the field cannot be deleted (only renamed). Applies to built-in fields.
 */
export interface MicrobiologyFieldDef {
  id: string;
  key: string;
  label: string;
  fixed: boolean;
}

/** Default field definitions — used when a template has no custom microbiology_fields */
export const DEFAULT_MICROBIOLOGY_FIELDS: MicrobiologyFieldDef[] = [
  { id: "default-sample_type", key: "sample_type", label: "Tipo de Muestra", fixed: true },
  { id: "default-gram_stain",  key: "gram_stain",  label: "Coloración de Gram / Examen Directo", fixed: true },
  { id: "default-culture_result", key: "culture_result", label: "Resultado del Cultivo", fixed: true },
];

export interface MicrobiologyResultsData {
  result_type: "MICROBIOLOGY";
  sample_type: string;
  gram_stain: string;
  /** Mode for culture output: 'text' for negative/free-text or 'germs' for isolated germs + antibiogram */
  culture_mode?: "text" | "germs";
  /** Values for extra custom fields defined in the template's microbiology_fields */
  extra_fields?: Record<string, string>;
  culture_result?: string;
  isolated_germs?: string[];
  antibiogram: AntibiogramEntry[];
}

export function isMicrobiologyResult(data: unknown): data is MicrobiologyResultsData {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>).result_type === "MICROBIOLOGY";
}

export function getGermSensitivity(entry: AntibiogramEntry, germIndex: number): SensitivityValue {
  if (entry.sensitivities && entry.sensitivities[germIndex] !== undefined) {
    return entry.sensitivities[germIndex];
  }
  if (germIndex === 0 && entry.sensitivity !== undefined) {
    return entry.sensitivity;
  }
  return null;
}

/**
 * Returns the effective microbiology field definitions for a template schema.
 * Falls back to DEFAULT_MICROBIOLOGY_FIELDS when none are stored.
 * Also ensures that fixed fields (sample_type, gram_stain, culture_result) are present.
 */
export function getMicrobiologyFields(schema: { microbiology_fields?: MicrobiologyFieldDef[] } | undefined | null): MicrobiologyFieldDef[] {
  if (schema?.microbiology_fields && schema.microbiology_fields.length > 0) {
    const fields = [...schema.microbiology_fields];
    // Check if culture_result exists; if not, append it for backward compatibility
    if (!fields.some(f => f.key === "culture_result")) {
      fields.push({ id: "default-culture_result", key: "culture_result", label: "Resultado del Cultivo", fixed: true });
    }
    return fields;
  }
  return DEFAULT_MICROBIOLOGY_FIELDS;
}
