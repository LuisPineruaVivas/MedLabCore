import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useInvoices } from "@/features/erp/hooks/useInvoices";
import { InvoiceStatusBadge } from "@/features/erp/components/InvoiceStatusBadge";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";

export default function AccountsReceivablePage() {
  const { orgId } = useCurrentOrgContext();
  // Overdue invoices are the most important ones here; they were missing before phase 8.
  const { data = [], isLoading } = useInvoices(orgId, ["overdue", "partial", "issued"]);
  const invoices = data
    .filter((invoice) => Number(invoice.balance_due_usd) > 0)
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    });
  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due_usd), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cuentas por cobrar"
        description={`Saldo pendiente total: ${formatCurrency(total)}. La antigüedad de saldos está en Reportes → Cuentas por cobrar.`}
      />
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Cargando cuentas...</TableCell></TableRow>
            ) : invoices.length ? (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell><Link to={`/erp/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">{invoice.invoice_number}</Link></TableCell>
                  <TableCell>{invoice.patients ? `${invoice.patients.first_name} ${invoice.patients.last_name}` : "—"}</TableCell>
                  <TableCell>{invoice.due_date ?? "Sin fecha"}</TableCell>
                  <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.balance_due_usd)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No hay cuentas pendientes.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
