import type { TemplateField, TemplateSection } from "@/features/tests/schemas";

/**
 * Pure edits of a template's sections and fields. Each returns a new array and never
 * mutates its input, so the form state only changes through setValue.
 */
export function renameSection(sections: TemplateSection[], sIdx: number, name: string): TemplateSection[] {
  return sections.map((section, i) => (i === sIdx ? { ...section, name } : section));
}

function withFields(
  sections: TemplateSection[],
  sIdx: number,
  edit: (fields: TemplateField[]) => TemplateField[],
): TemplateSection[] {
  return sections.map((section, i) => (i === sIdx ? { ...section, fields: edit([...section.fields]) } : section));
}

export function appendField(sections: TemplateSection[], sIdx: number, field: TemplateField): TemplateSection[] {
  return withFields(sections, sIdx, (fields) => [...fields, field]);
}

export function removeFieldAt(sections: TemplateSection[], sIdx: number, fIdx: number): TemplateSection[] {
  return withFields(sections, sIdx, (fields) => fields.filter((_, i) => i !== fIdx));
}

export function patchField(sections: TemplateSection[], sIdx: number, fIdx: number, patch: Partial<TemplateField>): TemplateSection[] {
  return withFields(sections, sIdx, (fields) => fields.map((field, i) => (i === fIdx ? { ...field, ...patch } : field)));
}

/** Swaps a field with its neighbour (-1 = up, 1 = down); out-of-range moves change nothing. */
export function moveField(sections: TemplateSection[], sIdx: number, fIdx: number, direction: -1 | 1): TemplateSection[] {
  const target = fIdx + direction;
  if (target < 0 || target >= sections[sIdx].fields.length) return sections;
  return withFields(sections, sIdx, (fields) => {
    [fields[target], fields[fIdx]] = [fields[fIdx], fields[target]];
    return fields;
  });
}

export function insertFieldAfter(sections: TemplateSection[], sIdx: number, fIdx: number, field: TemplateField): TemplateSection[] {
  return withFields(sections, sIdx, (fields) => {
    fields.splice(fIdx + 1, 0, field);
    return fields;
  });
}
