import type { ReferenceRange } from "@/features/tests/schemas";

export function getCategoryStyle(value: number, range: ReferenceRange | undefined) {
  if (!range?.categories || range.categories.length === 0 || !Number.isFinite(value)) {
    return "black";
  }

  const matchedCategory = range.categories.find((category) => {
    const min = Math.min(category.min, category.max);
    const max = Math.max(category.min, category.max);
    return value >= min && value <= max;
  });

  return matchedCategory?.color ?? "black";
}
