import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldType, ReferenceRange } from "@/features/tests/schemas";

export interface OrderResultFieldState {
  id?: string;
  label: string;
  type: FieldType;
  value?: string;
  unit?: string | null;
  range?: string | null;
  options?: string[];
  reference_ranges?: ReferenceRange[];
}

export interface OrderResultSectionState {
  id?: string;
  name: string;
  fields?: OrderResultFieldState[];
}

export interface OrderItemResultsState {
  sections?: OrderResultSectionState[];
}

export interface EditableOrderItem {
  id: string;
  category?: string | null;
  is_profile_header?: boolean | null;
  results_data?: OrderItemResultsState | string | null;
}

type ResultsMap = Record<string, OrderItemResultsState>;

export function cloneResultsValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function initializeResultsState(orderItems: EditableOrderItem[]): ResultsMap {
  const initialState: ResultsMap = {};

  for (const item of orderItems) {
    if (!item.results_data) continue;
    initialState[item.id] = typeof item.results_data === "string"
      ? JSON.parse(item.results_data)
      : cloneResultsValue(item.results_data);
  }

  return initialState;
}

export function groupEditableOrderItems(orderItems: EditableOrderItem[]) {
  const enterableItems = orderItems.filter((item) => !item.is_profile_header);
  return enterableItems.reduce<Record<string, EditableOrderItem[]>>((acc, item) => {
    const category = item.category || "Pruebas Especiales";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});
}

export function updateResultsField(
  previousState: ResultsMap,
  itemId: string,
  sectionIdx: number,
  fieldIdx: number,
  value: string
): ResultsMap {
  const currentItem = previousState[itemId];
  if (!currentItem) return previousState;

  const itemData = cloneResultsValue(currentItem);
  itemData.sections?.[sectionIdx]?.fields?.[fieldIdx] && (itemData.sections[sectionIdx].fields![fieldIdx].value = value);

  return {
    ...previousState,
    [itemId]: itemData,
  };
}

export function buildAppendedText(existingValue: string | undefined, option: string) {
  const trimmed = String(existingValue || "").trim();
  const separator = trimmed === "" ? "" : " ";
  return `${trimmed}${separator}${option}`.trim();
}

export function useOrderResultsEditor(orderItems: EditableOrderItem[]) {
  const [resultsState, setResultsState] = useState<ResultsMap>({});
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orderItems.length === 0) {
      setResultsState((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setModifiedIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    setResultsState(initializeResultsState(orderItems));
    setModifiedIds(new Set());
  }, [orderItems]);

  const updateFieldValue = useCallback((itemId: string, sectionIdx: number, fieldIdx: number, value: string) => {
    setResultsState((prev) => updateResultsField(prev, itemId, sectionIdx, fieldIdx, value));

    setModifiedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  const appendTextOption = useCallback((itemId: string, sectionIdx: number, fieldIdx: number, option: string) => {
    const existing = resultsState[itemId]?.sections?.[sectionIdx]?.fields?.[fieldIdx]?.value || "";
    const newValue = buildAppendedText(existing, option);
    updateFieldValue(itemId, sectionIdx, fieldIdx, newValue);
  }, [resultsState, updateFieldValue]);

  const groupedItems = useMemo(() => groupEditableOrderItems(orderItems), [orderItems]);

  const resetModified = useCallback(() => {
    setModifiedIds(new Set());
  }, []);

  return {
    resultsState,
    modifiedIds,
    groupedItems,
    updateFieldValue,
    appendTextOption,
    resetModified,
  };
}
