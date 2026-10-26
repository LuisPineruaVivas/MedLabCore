/**
 * Reads a JSON object stored as text or as JSON (results_data, template schema).
 * Malformed text gives {} instead of throwing, so one broken exam cannot make a
 * patient's whole report fail. Valid objects come back exactly as JSON.parse returns them.
 */
export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
