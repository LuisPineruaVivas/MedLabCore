import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useInvoicesPage } from "@/features/erp/hooks/useInvoices";
import { InvoiceStatusBadge } from "@/features/erp/components/InvoiceStatusBadge";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import type { InvoiceStatus } from "@/features/erp/types";

const PAGE_SIZE = 25;

export default function InvoicesPage() {
  const { orgId } = useCurrentOrgContext();
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useInvoicesPage(orgId, status, page, PAGE_SIZE);
  const invoices = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Facturas" description="Documentos financieros generados por las órdenes del laboratorio." />
      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value as InvoiceStatus | "all");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="issued">Emitidas</SelectItem>
          <SelectItem value="partial">Parciales</SelectItem>
          <SelectItem value="overdue">Vencidas</SelectItem>
          <SelectItem value="paid">Pagadas</SelectItem>
          <SelectItem value="cancelled">Anuladas</SelectItem>
        </SelectContent>
      </Select>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}>Cargando facturas...</TableCell></TableRow>
            ) : invoices.length ? (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell><Link className="font-medium text-primary hover:underline" to={`/erp/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></TableCell>
                  <TableCell>{invoice.patients ? `${invoice.patients.first_name} ${invoice.patients.last_name}` : "—"}</TableCell>
                  <TableCell>{new Date(invoice.issued_at).toLocaleDateString("es-VE")}</TableCell>
                  <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.total_usd)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.balance_due_usd)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No hay facturas para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("es-VE")} facturas
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1 || isFetching} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {pageCount}</span>
            <Button variant="outline" size="icon" onClick={() => setPage((value) => Math.min(value + 1, pageCount))} disabled={page >= pageCount || isFetching} aria-label="Página siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
