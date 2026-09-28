export type SensitivityValue = "S" | "I" | "R" | null | "";

export interface AntibiogramEntry {
  antibiotic_id: string;
  antibiotic_name: string;
  sensitivity?: SensitivityValue;
  sensitivities?: Record<number, SensitivityValue>;
}

export interface MicrobiologyResultsData {
  result_type: "MICROBIOLOGY";
  sample_type: string;
  gram_stain: string;
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
