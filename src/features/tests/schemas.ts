import { z } from "zod";

// ── Reference range for a field ─────────────────────────────────
export const referenceRangeSchema = z.object({
  id: z.string(),
  gender: z.enum(["masculino", "femenino", "ambos"]),
  age_min: z.coerce.number().nullable().optional(),
  age_max: z.coerce.number().nullable().optional(),
  min_value: z.coerce.number(),
  max_value: z.coerce.number(),
  description: z.string().trim().min(1, "Description is required"),
});

export type ReferenceRange = z.infer<typeof referenceRangeSchema>;

// ── Field inside a section ──────────────────────────────────────
export const templateFieldSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, "Field label is required"),
  type: z.enum(["number", "text", "select"]),
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
  "Other",
] as const;

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
