import { isMicrobiologyResult } from "@/features/microbiology/types";
import type { OrganizationInfo, ItemResultsData, OrderItem } from "./orderDetailTypes";

/** Progress of a category's exams: modified, all results entered, any result entered. */
export function getCategoryStats(
  itemsInCategory: OrderItem[],
  resultsState: Record<string, ItemResultsData>,
  modifiedIds: Set<string>
) {
  const hasAnyValue = (itemId: string) => {
    const data = resultsState[itemId];
    if (isMicrobiologyResult(data)) {
      return !!(data.sample_type || data.gram_stain || data.culture_result || data.isolated_germs?.some(g => g.trim()) || data.antibiogram?.some(a => a.sensitivity || Object.values(a.sensitivities || {}).some(Boolean)));
    }
    return data?.sections?.some((section) => section.fields?.some((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== ""));
  };

  const hasAllValues = (itemId: string) => {
    const data = resultsState[itemId];
    if (isMicrobiologyResult(data)) {
      return !!(data.sample_type && data.gram_stain && (data.isolated_germs?.some(g => g.trim()) || data.culture_result));
    }
    const sections = data?.sections;
    if (!sections || sections.length === 0) return false;

    let hasFields = false;
    const allFilled = sections.every((section) => {
      const fields = section.fields;
      if (!fields || fields.length === 0) return true;
      hasFields = true;
      return fields.every((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== "");
    });
    return hasFields && allFilled;
  };

  return {
    isCategoryModified: itemsInCategory.some((item) => modifiedIds.has(item.id)),
    allResultsEntered: itemsInCategory.every((item) => hasAllValues(item.id)),
    anyResultsEntered: itemsInCategory.some((item) => hasAnyValue(item.id)),
  };
}

/** Lab data for the PDFs (report, receipt, certificates) from the organization. */
export function buildLabData(lab: OrganizationInfo | null | undefined) {
  return {
    name: lab?.name || "Laboratorio",
    address: lab?.address || "",
    phone: lab?.phone || "",
    email: lab?.email || "",
    logo: lab?.logo_url || null,
    watermark: lab?.watermark_url || null,
    primary_color: lab?.primary_color || "#0ea5e9",
    secondary_color: lab?.secondary_color || "#0ea5e9",
    ciudad: lab?.city || "",
    rif: lab?.rif || "",
    lab_admin: lab?.profiles?.full_name || "",
    report_footer_text: lab?.report_footer_text || null,
  };
}
