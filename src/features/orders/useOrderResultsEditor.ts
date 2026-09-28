import { useCallback, useEffect, useMemo, useState } from "react";
import { isMicrobiologyResult, type MicrobiologyResultsData, type SensitivityValue, type AntibiogramEntry } from '@/features/microbiology/types';

export function updateMicrobiologyField<
  K extends keyof Omit<MicrobiologyResultsData, 'result_type' | 'antibiogram'>,
>(
  previousState: ResultsMap,
  itemId: string,
  field: K,
  value: MicrobiologyResultsData[K]
): ResultsMap {
  const currentItem = previousState[itemId];
  if (!currentItem || !isMicrobiologyResult(currentItem)) return previousState;

  const itemData = cloneResultsValue(currentItem) as MicrobiologyResultsData;
  itemData[field] = value as MicrobiologyResultsData[K];

  return {
    ...previousState,
    [itemId]: itemData as unknown as OrderItemResultsState,
  };
}

export function updateAntibiogramSensitivity(
  previousState: ResultsMap,
  itemId: string,
  antibioticIdx: number,
  sensitivity: SensitivityValue,
  germIndex = 0
): ResultsMap {
  const currentItem = previousState[itemId];
  if (!currentItem || !isMicrobiologyResult(currentItem)) return previousState;

  const itemData = cloneResultsValue(currentItem) as MicrobiologyResultsData;
  if (itemData.antibiogram && itemData.antibiogram[antibioticIdx]) {
    const entry = itemData.antibiogram[antibioticIdx];
    if (!entry.sensitivities) {
      entry.sensitivities = {};
      if (entry.sensitivity) {
        entry.sensitivities[0] = entry.sensitivity;
      }
    }
    entry.sensitivities[germIndex] = sensitivity;
    if (germIndex === 0) {
      entry.sensitivity = sensitivity;
    }
  }

  return {
    ...previousState,
    [itemId]: itemData as unknown as OrderItemResultsState,
  };
}

export function updateMicrobiologyGerms(
  previousState: ResultsMap,
  itemId: string,
  germs: string[]
): ResultsMap {
  const currentItem = previousState[itemId];
  if (!currentItem || !isMicrobiologyResult(currentItem)) return previousState;

  const itemData = cloneResultsValue(currentItem) as MicrobiologyResultsData;
  const slicedGerms = germs.slice(0, 3);
  itemData.isolated_germs = slicedGerms;
  itemData.culture_result = slicedGerms.filter(Boolean).join("\n");

  return {
    ...previousState,
    [itemId]: itemData as unknown as OrderItemResultsState,
  };
}

export function addAntibiogramEntry(
  previousState: ResultsMap,
  itemId: string,
  entry: AntibiogramEntry
): ResultsMap {
  const currentItem = previousState[itemId];
  if (!currentItem || !isMicrobiologyResult(currentItem)) return previousState;

  const itemData = cloneResultsValue(currentItem) as MicrobiologyResultsData;
  if (!itemData.antibiogram) {
    itemData.antibiogram = [];
  }
  
  if (!itemData.antibiogram.some((a) => a.antibiotic_id === entry.antibiotic_id)) {
    itemData.antibiogram.push(entry);
  }

  return {
    ...previousState,
    [itemId]: itemData as unknown as OrderItemResultsState,
  };
}
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
  test_method_id?: string | null;
  method_name?: string | null;
  results_data?: OrderItemResultsState | string | null;
  test_templates?: {
    result_type?: string | null;
    [key: string]: unknown;
  } | null;
}

type ResultsMap = Record<string, OrderItemResultsState>;
export type SelectedMethod = { id: string; name: string } | null;
type MethodsMap = Record<string, SelectedMethod>;

export function cloneResultsValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function initializeResultsState(orderItems: EditableOrderItem[]): ResultsMap {
  const initialState: ResultsMap = {};

  for (const item of orderItems) {
    let rawData: Record<string, unknown> | null = null;
    if (typeof item.results_data === "string") {
      try {
        rawData = JSON.parse(item.results_data);
      } catch (e) {
        rawData = null;
      }
    } else if (item.results_data && typeof item.results_data === "object") {
      rawData = item.results_data as Record<string, unknown>;
    }

    const isMicrobiology =
      item.test_templates?.result_type === "MICROBIOLOGY" ||
      rawData?.result_type === "MICROBIOLOGY";

    if (isMicrobiology) {
      const germs = Array.isArray(rawData?.isolated_germs)
        ? (rawData.isolated_germs as string[])
        : typeof rawData?.culture_result === "string" && rawData.culture_result.trim() !== ""
          ? rawData.culture_result.split("\n").map((s) => s.trim()).filter(Boolean)
          : [""];

      initialState[item.id] = {
        result_type: "MICROBIOLOGY",
        sample_type: typeof rawData?.sample_type === "string" ? rawData.sample_type : "",
        gram_stain: typeof rawData?.gram_stain === "string" ? rawData.gram_stain : "",
        culture_result: typeof rawData?.culture_result === "string" ? rawData.culture_result : "",
        isolated_germs: germs.length > 0 ? germs : [""],
        antibiogram: Array.isArray(rawData?.antibiogram) ? rawData.antibiogram : [],
      } as unknown as OrderItemResultsState;
    } else if (rawData) {
      initialState[item.id] = cloneResultsValue(rawData as unknown as OrderItemResultsState);
    }
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
  const targetField = itemData.sections?.[sectionIdx]?.fields?.[fieldIdx];
  if (targetField) {
    targetField.value = value;
  }

  return {
    ...previousState,
    [itemId]: itemData,
  };
}

export function buildAppendedText(existingValue: string | undefined, option: string) {
  const trimmed = String(existingValue || "").trim();
  if (trimmed === "") return option.trim();
  const isMultiline = option.includes("\n") || trimmed.includes("\n");
  const separator = isMultiline ? "\n\n" : " ";
  return `${trimmed}${separator}${option}`.trim();
}

export function useOrderResultsEditor(orderItems: EditableOrderItem[]) {
  const [resultsState, setResultsState] = useState<ResultsMap>({});
  const [methodsState, setMethodsState] = useState<MethodsMap>({});
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orderItems.length === 0) {
      setResultsState((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setMethodsState((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setModifiedIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    setResultsState(initializeResultsState(orderItems));
    setMethodsState(Object.fromEntries(orderItems.map((item) => [
      item.id,
      item.test_method_id && item.method_name ? { id: item.test_method_id, name: item.method_name } : null,
    ])));
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

  const updateMicroField = useCallback((itemId: string, field: keyof Omit<MicrobiologyResultsData, "result_type" | "antibiogram" | "isolated_germs">, value: string) => {
    setResultsState((prev) => updateMicrobiologyField(prev, itemId, field, value));
    setModifiedIds((prev) => new Set(prev).add(itemId));
  }, []);

  const updateMicroGerms = useCallback((itemId: string, germs: string[]) => {
    setResultsState((prev) => updateMicrobiologyGerms(prev, itemId, germs));
    setModifiedIds((prev) => new Set(prev).add(itemId));
  }, []);

  const updateAntibiogram = useCallback((itemId: string, antibioticIdx: number, sensitivity: SensitivityValue, germIndex = 0) => {
    setResultsState((prev) => updateAntibiogramSensitivity(prev, itemId, antibioticIdx, sensitivity, germIndex));
    setModifiedIds((prev) => new Set(prev).add(itemId));
  }, []);

  const addAntibiogram = useCallback((itemId: string, entry: AntibiogramEntry) => {
    setResultsState((prev) => addAntibiogramEntry(prev, itemId, entry));
    setModifiedIds((prev) => new Set(prev).add(itemId));
  }, []);
  const updateMethod = useCallback((itemId: string, method: SelectedMethod) => {
    setMethodsState((previous) => ({ ...previous, [itemId]: method }));
    setModifiedIds((previous) => new Set(previous).add(itemId));
  }, []);

  const groupedItems = useMemo(() => groupEditableOrderItems(orderItems), [orderItems]);

  const resetModified = useCallback(() => {
    setModifiedIds(new Set());
  }, []);

  return {
    resultsState,
    methodsState,
    modifiedIds,
    groupedItems,
    updateFieldValue,
    appendTextOption,
    updateMethod,
    updateMicroField,
    updateMicroGerms,
    updateAntibiogram,
    addAntibiogram,
    resetModified,
  };
}


