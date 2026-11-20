import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import type { AgingBucket } from "../types";

export type PeriodPreset = "today" | "this_month" | "last_month" | "last_30" | "custom";

export interface ReportPeriod {
  preset: PeriodPreset;
  from: string; // yyyy-MM-dd, inclusive
  to: string; // yyyy-MM-dd, inclusive
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoy",
  this_month: "Este mes",
  last_month: "Mes anterior",
  last_30: "Últimos 30 días",
  custom: "Personalizado",
};

const toIso = (date: Date) => format(date, "yyyy-MM-dd");

export function buildPeriod(preset: Exclude<PeriodPreset, "custom">, now = new Date()): ReportPeriod {
  switch (preset) {
    case "today":
      return { preset, from: toIso(now), to: toIso(now) };
    case "last_month": {
      const previous = subMonths(now, 1);
      return { preset, from: toIso(startOfMonth(previous)), to: toIso(endOfMonth(previous)) };
    }
    case "last_30":
      return { preset, from: toIso(subDays(now, 29)), to: toIso(now) };
    case "this_month":
    default:
      return { preset: "this_month", from: toIso(startOfMonth(now)), to: toIso(now) };
  }
}

export function isValidPeriod(period: Pick<ReportPeriod, "from" | "to">) {
  return /^\d{4}-\d{2}-\d{2}$/.test(period.from) && /^\d{4}-\d{2}-\d{2}$/.test(period.to) && period.from <= period.to;
}

/** Change versus the previous period of the same length; null when there is no base to compare. */
export function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Por vencer",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90_plus: "Más de 90 días",
};

export const AGING_ORDER: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];

/** Margin under this threshold is flagged in the profitability report. */
export const LOW_MARGIN_PCT = 50;

export function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value.toLocaleString("es-VE", { maximumFractionDigits: 1 })}%`;
}

export function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}` : isoDate;
}
