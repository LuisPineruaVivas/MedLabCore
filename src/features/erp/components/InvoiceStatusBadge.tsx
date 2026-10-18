import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "../types";

const labels: Record<InvoiceStatus, string> = { draft: "Borrador", issued: "Emitida", partial: "Parcial", paid: "Pagada", overdue: "Vencida", cancelled: "Anulada", credit_note: "Nota de crédito" };
const variants: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", issued: "outline", partial: "outline", paid: "default", overdue: "destructive", cancelled: "destructive", credit_note: "secondary" };
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) { return <Badge variant={variants[status]}>{labels[status]}</Badge>; }
