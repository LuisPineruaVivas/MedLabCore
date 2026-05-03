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
  "Coproanalisis", 
  "Orina Parcial",
  "Orina De 24 Horas",
  "Pruebas Especiales",
] as const;

type NumericLikeValue = string | number | null | undefined;

type ParsedResultExpression =
  | { kind: "exact"; value: number }
  | { kind: "interval"; min: number; max: number }
  | { kind: "lt"; value: number }
  | { kind: "gt"; value: number };

type ReferenceBounds = {
  min: number;
  max: number;
};

function normalizeFreeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractNumbers(value: NumericLikeValue) {
  const matches = String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches
    .map((match) => Number(match.replace(",", ".")))
    .filter((parsed) => Number.isFinite(parsed));
}

function parseReferenceBounds(
  matchedRange?: ReferenceRange,
  legacyRange?: string | null
): ReferenceBounds | null {
  if (matchedRange) {
    return {
      min: Math.min(matchedRange.min_value, matchedRange.max_value),
      max: Math.max(matchedRange.min_value, matchedRange.max_value),
    };
  }

  const values = extractNumbers(legacyRange);
  if (values.length >= 2) {
    return {
      min: Math.min(values[0], values[1]),
      max: Math.max(values[0], values[1]),
    };
  }

  if (values.length === 1) {
    return {
      min: values[0],
      max: values[0],
    };
  }

  return null;
}

function parseFlexibleResultExpression(rawValue: NumericLikeValue): ParsedResultExpression | null {
  const rawText = String(rawValue ?? "").trim();
  if (!rawText) return null;

  const numbers = extractNumbers(rawText);
  if (numbers.length === 0) return null;

  const normalized = normalizeFreeText(rawText);
  const hasGreaterComparator =
    rawText.includes(">") ||
    /\b(mas de|mayor que|mayores que|superior a|above|over|greater than)\b/.test(normalized);
  const hasLessComparator =
    rawText.includes("<") ||
    /\b(menos de|menor que|menores que|inferior a|below|under|less than)\b/.test(normalized);

  if (hasGreaterComparator && !hasLessComparator) {
    return { kind: "gt", value: numbers[0] };
  }

  if (hasLessComparator && !hasGreaterComparator) {
    return { kind: "lt", value: numbers[0] };
  }

  if (numbers.length >= 2) {
    return {
      kind: "interval",
      min: Math.min(numbers[0], numbers[1]),
      max: Math.max(numbers[0], numbers[1]),
    };
  }

  return { kind: "exact", value: numbers[0] };
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
  legacyRange: string | null | undefined,
  fieldType: FieldType
) {
  const referenceBounds = parseReferenceBounds(matchedRange, legacyRange);
  if (!referenceBounds) return false;

  const parsed = parseFlexibleResultExpression(value);
  if (!parsed) return false;

  if (fieldType === "number") {
    if (parsed.kind !== "exact") return false;
    return parsed.value < referenceBounds.min || parsed.value > referenceBounds.max;
  }

  if (fieldType !== "range") {
    return false;
  }

  switch (parsed.kind) {
    case "exact":
      return parsed.value < referenceBounds.min || parsed.value > referenceBounds.max;
    case "interval":
      return parsed.min < referenceBounds.min || parsed.max > referenceBounds.max;
    case "lt":
      return parsed.value <= referenceBounds.min;
    case "gt":
      return parsed.value >= referenceBounds.max;
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
  const isOutOfRange = isValueOutOfReferenceRange(field.value, matchedRange, field.range, field.type);

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
