import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../utils/currencyFormatters";
import { buildPeriod, formatShortDate, PERIOD_LABELS, type PeriodPreset, type ReportPeriod } from "../utils/reports";

const SERIES_COLOR = "hsl(var(--chart-1))";

export function PeriodFilter({ value, onChange }: { value: ReportPeriod; onChange: (period: ReportPeriod) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        value={value.preset}
        onValueChange={(preset) =>
          onChange(preset === "custom" ? { ...value, preset: "custom" } : buildPeriod(preset as Exclude<PeriodPreset, "custom">))
        }
      >
        <SelectTrigger className="w-44" aria-label="Período"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([preset, label]) => <SelectItem key={preset} value={preset}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <>
          <Input type="date" className="w-40" value={value.from} max={value.to} onChange={(event) => onChange({ ...value, from: event.target.value })} aria-label="Desde" />
          <Input type="date" className="w-40" value={value.to} min={value.from} onChange={(event) => onChange({ ...value, to: event.target.value })} aria-label="Hasta" />
        </>
      )}
    </div>
  );
}

function DailyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{String(label)}</p>
      <p className="font-semibold text-foreground">{formatCurrency(Number(payload[0].value))}</p>
    </div>
  );
}

/** Single-series area chart of collected USD per day, with a data table for screen readers and print. */
export function DailyCollectedChart({ data }: { data: { date: string; total_usd: number }[] }) {
  const rows = data.map((point) => ({ ...point, label: formatShortDate(point.date), total_usd: Number(point.total_usd) }));
  return (
    <div className="space-y-2">
      <div className="h-56 w-full" role="img" aria-label="Cobrado por día en USD">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dailyCollectedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value: number) => `$${value.toLocaleString("es-VE")}`} />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} />
            <Area
              type="monotone"
              dataKey="total_usd"
              stroke={SERIES_COLOR}
              strokeWidth={2}
              fill="url(#dailyCollectedFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: SERIES_COLOR }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Ver datos</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded border">
          <table className="w-full">
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-b last:border-0">
                  <td className="px-2 py-1">{row.label}</td>
                  <td className="px-2 py-1 text-right text-foreground">{formatCurrency(row.total_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Text shown at the end of the bar; defaults to the formatted value. */
  display?: string;
  hint?: string;
}

/**
 * Horizontal bars as plain HTML: label and value are always visible text, so the
 * data never depends on color, and each bar carries a native tooltip.
 */
export function HorizontalBars({ rows, emptyText, formatValue = (value) => formatCurrency(value) }: { rows: BarRow[]; emptyText: string; formatValue?: (value: number) => string }) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || max <= 0) return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} title={`${row.label}: ${row.display ?? formatValue(row.value)}${row.hint ? ` · ${row.hint}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {row.display ?? formatValue(row.value)}
              {row.hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{row.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full")}
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%`, backgroundColor: SERIES_COLOR }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportCard({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
