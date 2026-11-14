import { useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Plus, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { CancelPayableDialog, NewPayableDialog, PayPayableDialog } from "@/features/erp/components/PayableDialogs";
import { usePayables, usePayablesSummary, type PayableFilter } from "@/features/erp/hooks/usePayables";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { isOverdue, PAYABLE_STATUS_LABELS } from "@/features/erp/utils/finance";
import { formatShortDate } from "@/features/erp/utils/reports";
import type { Payable } from "@/features/erp/types";

const PAGE_SIZE = 50;
const FILTER_LABELS: Record<PayableFilter, string> = { open: "Pendientes", paid: "Pagadas", cancelled: "Anuladas", all: "Todas" };

export default function PayablesPage() {
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances: isAdmin } = useErpModule();
  const [filter, setFilter] = useState<PayableFilter>("open");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Payable | null>(null);
  const [cancelling, setCancelling] = useState<Payable | null>(null);
  const { data, isLoading, isFetching } = usePayables(orgId, filter, page, PAGE_SIZE);
  const { data: summary = [] } = usePayablesSummary(orgId);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Por pagar"
        description="Facturas de proveedores, servicios y demás deudas del laboratorio. Las compras de inventario sin pagar llegan aquí."
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nueva cuenta por pagar</Button>}
      />

      <section className="grid gap-3 sm:grid-cols-2">
        {summary.length ? summary.map((row) => (
          <div key={row.currency} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pendiente en {row.currency} ({row.count})</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(row.pending, row.currency)}</p>
            {Number(row.overdue) > 0 && <p className="mt-1 text-sm text-destructive">Vencido: {formatCurrency(row.overdue, row.currency)} ({row.overdue_count})</p>}
          </div>
        )) : (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground sm:col-span-2">No hay cuentas por pagar pendientes.</div>
        )}
      </section>

      <Select value={filter} onValueChange={(value) => { setFilter(value as PayableFilter); setPage(1); }}>
        <SelectTrigger className="w-44" aria-label="Estado"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vence</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right max-sm:hidden">Monto</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const overdue = isOverdue(row.due_date, row.status);
                const open = row.status === "pending" || row.status === "partial";
                return (
                  <TableRow key={row.id}>
                    <TableCell className={`whitespace-nowrap ${overdue ? "font-medium text-destructive" : ""}`}>{row.due_date ? formatShortDate(row.due_date) : "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {[row.payee, row.finance_categories?.name, row.reference_number && `Ref. ${row.reference_number}`].filter(Boolean).join(" · ")}
                        {row.cancel_reason && <span className="text-destructive"> · Anulada: {row.cancel_reason}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={overdue ? "destructive" : row.status === "paid" ? "default" : "outline"}>{overdue ? "Vencida" : PAYABLE_STATUS_LABELS[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right max-sm:hidden">{formatCurrency(row.amount, row.currency)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium">{open ? formatCurrency(Number(row.amount) - Number(row.amount_paid), row.currency) : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {open && <Button size="sm" variant="outline" onClick={() => setPaying(row)}><Wallet className="mr-1 h-4 w-4" />Pagar</Button>}
                      {open && isAdmin && <Button size="icon" variant="ghost" aria-label="Anular cuenta por pagar" onClick={() => setCancelling(row)}><Ban className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <ReceiptText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No hay cuentas por pagar en este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("es-VE")}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1 || isFetching} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span>Página {page} de {pageCount}</span>
            <Button variant="outline" size="icon" onClick={() => setPage((value) => Math.min(value + 1, pageCount))} disabled={page >= pageCount || isFetching} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <NewPayableDialog open={creating} onOpenChange={setCreating} />
      <PayPayableDialog payable={paying} onClose={() => setPaying(null)} />
      <CancelPayableDialog payable={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
