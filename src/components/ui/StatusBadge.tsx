import { cn } from "@/lib/utils";

type Status = "pendiente" | "procesando" | "completada" | "cancelada";

const statusConfig: Record<Status, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  procesando: {
    label: "Procesando",
    className: "bg-info/10 text-info border-info/20",
  },
  completada: {
    label: "Completada",
    className: "bg-success/10 text-success border-success/20",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
