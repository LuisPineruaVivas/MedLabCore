import type { TemplateField, TemplateSection } from "@/features/tests/schemas";
import { appendField, insertFieldAfter, moveField, patchField, removeFieldAt, renameSection } from "./templateSectionOps";

const field = (label: string): TemplateField => ({ id: label, label, type: "number" });
const sections = (): TemplateSection[] => [
  { id: "s1", name: "Serie Roja", fields: [field("A"), field("B"), field("C")] },
  { id: "s2", name: "Serie Blanca", fields: [field("D")] },
];
const labels = (list: TemplateSection[], sIdx = 0) => list[sIdx].fields.map((f) => f.label);

describe("template section operations", () => {
  it("rename, append, remove and patch only touch the target section", () => {
    const original = sections();
    expect(renameSection(original, 1, "Leucocitos")[1].name).toBe("Leucocitos");
    expect(labels(appendField(original, 0, field("E")))).toEqual(["A", "B", "C", "E"]);
    expect(labels(removeFieldAt(original, 0, 1))).toEqual(["A", "C"]);
    expect(patchField(original, 0, 2, { unit: "g/dL" })[0].fields[2]).toMatchObject({ label: "C", unit: "g/dL" });
    expect(labels(appendField(original, 0, field("E")), 1)).toEqual(["D"]);
    expect(labels(original)).toEqual(["A", "B", "C"]); // input never mutated
  });

  it("moves fields up and down, ignoring moves past the edges", () => {
    const original = sections();
    expect(labels(moveField(original, 0, 1, -1))).toEqual(["B", "A", "C"]);
    expect(labels(moveField(original, 0, 1, 1))).toEqual(["A", "C", "B"]);
    expect(moveField(original, 0, 0, -1)).toBe(original);
    expect(moveField(original, 0, 2, 1)).toBe(original);
  });

  it("inserts a field right after another", () => {
    expect(labels(insertFieldAfter(sections(), 0, 0, field("X")))).toEqual(["A", "X", "B", "C"]);
  });
});
