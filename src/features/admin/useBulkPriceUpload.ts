import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// ── Types ─────────────────────────────────────────────────────────

export interface ParsedPriceItem {
  /** Name as extracted by Gemini (uppercase) */
  name: string;
  /** Price as extracted by Gemini */
  price: number;
}

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MatchedPriceItem {
  /** Original name from baremo */
  extracted_name: string;
  /** Extracted price */
  price: number;
  /** Matched global template ID (null if no match) */
  global_template_id: string | null;
  /** Matched template name from DB */
  matched_name: string | null;
  /** Similarity 0-100 */
  confidence: number;
  /** High / Medium / Low / None */
  confidence_label: MatchConfidence;
  /** User can override the match */
  overridden: boolean;
}

// ── Fuzzy matching helpers ────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^A-Z0-9\s]/g, " ")   // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Returns a similarity score 0-100 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 90;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(na, nb);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

function confidenceLabel(score: number): MatchConfidence {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  if (score >= 50) return "low";
  return "none";
}

// ── Step 1: Parse file with Gemini via Edge Function ─────────────

export function useParsePriceList() {
  return useMutation({
    mutationFn: async (payload: {
      file_base64?: string;
      text_content?: string;
      mime_type?: string;
    }): Promise<ParsedPriceItem[]> => {
      const { data, error } = await supabase.functions.invoke("parse-price-list", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.items as ParsedPriceItem[];
    },
  });
}

// ── Step 2: Match extracted items against global templates ────────

export interface GlobalTemplate {
  id: string;
  name: string;
}

export function matchPriceItems(
  parsed: ParsedPriceItem[],
  globalTemplates: GlobalTemplate[]
): MatchedPriceItem[] {
  return parsed.map((item) => {
    let bestScore = 0;
    let bestTemplate: GlobalTemplate | null = null;

    for (const tpl of globalTemplates) {
      const score = similarity(item.name, tpl.name);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = tpl;
      }
    }

    // Only accept a match if similarity ≥ 50
    const matched = bestScore >= 50 ? bestTemplate : null;

    return {
      extracted_name: item.name,
      price: item.price,
      global_template_id: matched?.id ?? null,
      matched_name: matched?.name ?? null,
      confidence: matched ? bestScore : 0,
      confidence_label: matched ? confidenceLabel(bestScore) : "none",
      overridden: false,
    };
  });
}

// ── Step 3: Apply bulk upsert via Supabase RPC ────────────────────

export function useBulkUpsertPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      items,
    }: {
      orgId: string;
      items: MatchedPriceItem[];
    }): Promise<{ applied: number; skipped: number }> => {
      // Only send items that have a valid match
      const toApply = items
        .filter((i) => i.global_template_id !== null)
        .map((i) => ({
          global_template_id: i.global_template_id,
          price: i.price,
        }));

      if (toApply.length === 0) {
        return { applied: 0, skipped: items.length };
      }

      const { data, error } = await supabase.rpc("bulk_upsert_org_prices", {
        p_org_id: orgId,
        p_items: toApply,
      });

      if (error) throw error;

      return data as { applied: number; skipped: number };
    },
    onSuccess: (_, variables) => {
      // Invalidate templates for this org
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.testTemplates.list(variables.orgId, { scope: "admin" }),
      });
    },
  });
}

// ── Composite hook: Orchestrates the full flow ────────────────────

export type BulkUploadStep = "idle" | "parsing" | "review" | "applying" | "done";

export interface BulkUploadState {
  step: BulkUploadStep;
  matchedItems: MatchedPriceItem[];
  result: { applied: number; skipped: number } | null;
  error: string | null;
}

export function useBulkPriceUpload() {
  const [state, setState] = useState<BulkUploadState>({
    step: "idle",
    matchedItems: [],
    result: null,
    error: null,
  });

  const parseMutation = useParsePriceList();
  const applyMutation = useBulkUpsertPrices();

  function reset() {
    setState({ step: "idle", matchedItems: [], result: null, error: null });
  }

  async function parseFile(
    payload: { file_base64?: string; text_content?: string; mime_type?: string },
    globalTemplates: GlobalTemplate[]
  ) {
    setState((s) => ({ ...s, step: "parsing", error: null }));
    try {
      const parsed = await parseMutation.mutateAsync(payload);
      const matched = matchPriceItems(parsed, globalTemplates);
      setState((s) => ({ ...s, step: "review", matchedItems: matched }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar el archivo";
      setState((s) => ({ ...s, step: "idle", error: msg }));
    }
  }

  function updateItem(index: number, patch: Partial<MatchedPriceItem>) {
    setState((s) => ({
      ...s,
      matchedItems: s.matchedItems.map((item, i) =>
        i === index ? { ...item, ...patch, overridden: true } : item
      ),
    }));
  }

  function removeItem(index: number) {
    setState((s) => ({
      ...s,
      matchedItems: s.matchedItems.filter((_, i) => i !== index),
    }));
  }

  async function applyPrices(orgId: string) {
    setState((s) => ({ ...s, step: "applying", error: null }));
    try {
      const result = await applyMutation.mutateAsync({ orgId, items: state.matchedItems });
      setState((s) => ({ ...s, step: "done", result }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al aplicar los precios";
      setState((s) => ({ ...s, step: "review", error: msg }));
    }
  }

  return {
    state,
    isParsing: parseMutation.isPending,
    isApplying: applyMutation.isPending,
    parseFile,
    updateItem,
    removeItem,
    applyPrices,
    reset,
  };
}
