import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    // Compact on phones so a row of figures never pushes the screen's real work below the fold.
    <div className={cn("stat-card p-3.5 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5 sm:space-y-1">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
          <p className="text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl neu-inset sm:flex" aria-hidden>
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-border">
          <span
            className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground ml-1.5">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
