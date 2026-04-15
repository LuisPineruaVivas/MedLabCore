import { z } from "zod";

// ── Reference range for a field ─────────────────────────────────
export const referenceRangeSchema = z.object({
  id: z.string(),
  gender: z.enum(["masculino", "femenino", "ambos"]),
  age_min: z.coerce.number().nullable().optional(),
  age_max: z.coerce.number().nullable().optional(),
  min_value: z.coerce.number(),
  max_value: z.coerce.number(),
  description: z.string().optional().or(z.literal("")),
});

export type ReferenceRange = z.infer<typeof referenceRangeSchema>;

export const fieldTypeSchema = z.enum(["number", "text", "select", "range"]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

// ── Field inside a section ──────────────────────────────────────
export const templateFieldSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, "Field label is required"),
  type: fieldTypeSchema,
  unit: z.string().nullable().optional().or(z.literal("")),
  // Legacy string range kept optional for backward compat
  range: z.string().nullable().optional().or(z.literal("")),
  // New structured reference ranges
  reference_ranges: z.array(referenceRangeSchema).optional(),
  options: z.array(z.string()).optional(),
});

export const templateSectionSchema = z.object({
  id: z.string(),
  name: z.string().trim().default("General"),
  fields: z.array(templateFieldSchema).min(1, "At least one field is required"),
});

export const templateJsonSchema = z.object({
  sections: z.array(templateSectionSchema).default([]),
});

// ── Full template form ──────────────────────────────────────────
export const testTemplateFormSchema = z.object({
  id: z.string().uuid("Invalid template").optional(),
  name: z.string().trim().min(1, "Test name is required").max(200),
  category: z.string().trim().min(1, "Category is required"),
  base_price: z.coerce.number().min(0, "Price must be positive"),
  schema: templateJsonSchema,
});

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateSection = z.infer<typeof templateSectionSchema>;
export type TemplateJsonSchema = z.infer<typeof templateJsonSchema>;
export type TestTemplateFormData = z.infer<typeof testTemplateFormSchema>;

export interface TestTemplateRow {
  id: string;
  org_id: string | null;
  name: string;
  category: string;
  base_price: number;
  schema: TemplateJsonSchema;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Categories
export const TEMPLATE_CATEGORIES = [
  "Hematologia",
  "Bioquimica",
  "Uroanalisis",
  "Endocrinologia",
  "Microbiologia",
  "Immunologia",
  "Serologia",
  "Coagulacion",
  "Pruebas Especiales",
] as const;

type NumericLikeValue = string | number | null | undefined;

function parseNumericToken(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type ParsedRangeInput =
  | { kind: "exact"; value: number }
  | { kind: "interval"; min: number; max: number }
  | { kind: "lt"; value: number }
  | { kind: "gt"; value: number };

function parseSemiQuantitativeValue(rawValue: NumericLikeValue): ParsedRangeInput | null {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;

  const lessThanMatch = value.match(/^<\s*(-?\d+(?:[.,]\d+)?)$/);
  if (lessThanMatch) {
    const parsed = parseNumericToken(lessThanMatch[1]);
    return parsed == null ? null : { kind: "lt", value: parsed };
  }

  const greaterThanMatch = value.match(/^>\s*(-?\d+(?:[.,]\d+)?)$/);
  if (greaterThanMatch) {
    const parsed = parseNumericToken(greaterThanMatch[1]);
    return parsed == null ? null : { kind: "gt", value: parsed };
  }

  const intervalMatch = value.match(/^(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)$/);
  if (intervalMatch) {
    const first = parseNumericToken(intervalMatch[1]);
    const second = parseNumericToken(intervalMatch[2]);
    if (first == null || second == null) return null;

    return {
      kind: "interval",
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  }

  const exact = parseNumericToken(value);
  return exact == null ? null : { kind: "exact", value: exact };
}

export function sanitizeRangeInput(value: string) {
  return value.replace(/[^\d<>\-\s]/g, "");
}

export function getReferenceRangeDisplay(
  matchedRange?: ReferenceRange,
  legacyRange?: string | null
) {
  if (matchedRange) {
    return `${matchedRange.min_value} - ${matchedRange.max_value}`;
  }

  return legacyRange || "";
}

export function isValueOutOfReferenceRange(
  value: NumericLikeValue,
  matchedRange: ReferenceRange | undefined,
  fieldType: FieldType
) {
  if (!matchedRange) return false;

  const parsed = parseSemiQuantitativeValue(value);
  if (!parsed) return false;

  if (fieldType === "number") {
    if (parsed.kind !== "exact") return false;
    return parsed.value < matchedRange.min_value || parsed.value > matchedRange.max_value;
  }

  if (fieldType !== "range") {
    return false;
  }

  switch (parsed.kind) {
    case "exact":
      return parsed.value < matchedRange.min_value || parsed.value > matchedRange.max_value;
    case "interval":
      return parsed.min < matchedRange.min_value || parsed.max > matchedRange.max_value;
    case "lt":
      return parsed.value < matchedRange.min_value;
    case "gt":
      return parsed.value > matchedRange.max_value;
  }
}

export function getFieldResultMeta(
  field: {
    type: FieldType;
    value?: NumericLikeValue;
    range?: string | null;
    reference_ranges?: ReferenceRange[];
  },
  patientGender?: string,
  patientAge?: number
) {
  const matchedRange = findMatchingRange(field.reference_ranges, patientGender, patientAge);
  const rangeDisplay = getReferenceRangeDisplay(matchedRange, field.range);
  const isOutOfRange = isValueOutOfReferenceRange(field.value, matchedRange, field.type);

  return {
    matchedRange,
    rangeDisplay,
    isOutOfRange,
  };
}

// ── Helper: find matching reference range for a patient ─────────
export function findMatchingRange(
  ranges: ReferenceRange[] | undefined,
  patientGender?: string,
  patientAge?: number
): ReferenceRange | undefined {
  if (!ranges || ranges.length === 0) return undefined;

  // Normalize gender
  const gender = patientGender?.toLowerCase() === "femenino" || patientGender?.toLowerCase() === "femenino"
    ? "femenino"
    : patientGender?.toLowerCase() === "masculino" || patientGender?.toLowerCase() === "masculino"
      ? "masculino"
      : undefined;

  // Try exact match (gender + age)
  const exact = ranges.find((r) => {
    const genderMatch = r.gender === "ambos" || r.gender === gender;
    const ageMatch =
      (r.age_min == null || (patientAge != null && patientAge >= r.age_min)) &&
      (r.age_max == null || (patientAge != null && patientAge <= r.age_max));
    return genderMatch && ageMatch;
  });

  if (exact) return exact;

  // Fallback: find a 'both' range
  return ranges.find((r) => r.gender === "ambos");
}
