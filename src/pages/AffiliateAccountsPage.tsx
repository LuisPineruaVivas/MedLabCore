import { useEffect, useMemo, useState } from "react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import { HandCoins, Printer, CheckCheck, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAffiliateOrders, useAffiliatePendingBalance, useAffiliateUsers, useMarkAffiliateOrdersPaid } from "@/features/billing/useAffiliateAccounts";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { isMobileDevice } from "@/features/orders/orderDetailUtils";
import { buildLabData } from "@/features/orders/OrderDetailSections";
import { AffiliateAccountStatementPDF } from "@/lib/affiliateAccountStatementPDF";

export default function AffiliateAccountsPage() {
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);

  const { organization } = useCurrentOrgContext();
  const { data: affiliates = [], isLoading: affiliatesLoading } = useAffiliateUsers();

  useEffect(() => {
    if (!selectedAffiliateId && affiliates.length > 0) {
      setSelectedAffiliateId(affiliates[0].id);
    }
  }, [affiliates, selectedAffiliateId]);

  const selectedAffiliate = affiliates.find((affiliate) => affiliate.id === selectedAffiliateId) ?? null;
  const { data: pendingBalance = 0, isLoading: balanceLoading } = useAffiliatePendingBalance(selectedAffiliateId || null);
  const { data: orders = [], isLoading: ordersLoading } = useAffiliateOrders(selectedAffiliateId || null, paymentStatus);
  const markPaid = useMarkAffiliateOrdersPaid();

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedAffiliateId, paymentStatus]);

  const selectableOrders = useMemo(
    () => orders.filter((order) => order.payment_status === "pending"),
    [orders]
  );
  const allVisiblePendingSelected =
    selectableOrders.length > 0 && selectableOrders.every((order) => selectedIds.includes(order.id));

  const selectedPendingOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id) && order.payment_status === "pending"),
    [orders, selectedIds]
  );
  const labData = useMemo(() => buildLabData(organization), [organization]);

  function toggleRow(orderId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, orderId])] : current.filter((id) => id !== orderId)
    );
  }

  function toggleAllVisible(checked: boolean) {
    const visibleIds = selectableOrders.map((order) => order.id);
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, ...visibleIds])]
        : current.filter((id) => !visibleIds.includes(id))
    );
  }

  async function handlePrintSelection() {
    if (!selectedAffiliate || selectedPendingOrders.length === 0) {
      return;
    }

    if (isMobileDevice()) {
      setStatementLoading(true);
      try {
        const statementBlob = await pdf(
          <AffiliateAccountStatementPDF
            affiliateName={selectedAffiliate.full_name || selectedAffiliate.email || "Afiliado"}
            affiliateEmail={selectedAffiliate.email}
            orders={selectedPendingOrders}
            labData={labData}
          />
        ).toBlob();

        const url = URL.createObjectURL(statementBlob);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Error abriendo cuenta de cobro en movil:", error);
      } finally {
        setStatementLoading(false);
      }
      return;
    }

    setStatementOpen(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cuentas de Afiliados"
        description="Conciliacion y cobro de ordenes generadas por laboratorios aliados."
      />

      <div className="grid gap-4 md:grid-cols-[minmax(280px,360px)_1fr]">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Laboratorio afiliado</p>
              <Select
                value={selectedAffiliateId}
                onValueChange={setSelectedAffiliateId}
                disabled={affiliatesLoading || affiliates.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un afiliado" />
                </SelectTrigger>
                <SelectContent>
                  {affiliates.map((affiliate) => (
                    <SelectItem key={affiliate.id} value={affiliate.id}>
                      {affiliate.full_name || affiliate.email || affiliate.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedAffiliate?.email || "Sin afiliado seleccionado"}
            </div>
          </CardHeader>
        </Card>

        <StatCard
          title="Saldo total adeudado"
          value={balanceLoading ? "..." : `$${Number(pendingBalance).toFixed(2)}`}
          subtitle="Suma de ordenes en estado pendiente"
          icon={HandCoins}
          className="border border-border bg-card shadow-sm"
        />
      </div>

      <Card className="border border-border bg-card p-0 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="paid">Pagadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => selectedAffiliateId && markPaid.mutate({ affiliateId: selectedAffiliateId, orderIds: selectedPendingOrders.map((order) => order.id) })}
              disabled={!selectedAffiliateId || selectedPendingOrders.length === 0 || markPaid.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              {markPaid.isPending ? "Actualizando..." : "Marcar seleccionadas como Pagadas"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintSelection}
              disabled={selectedPendingOrders.length === 0 || statementLoading}
            >
              <Printer className="mr-2 h-4 w-4" />
              {statementLoading ? "Generando..." : "Imprimir / Exportar soporte"}
            </Button>
          </div>
        </CardHeader>

        <Table className="hidden md:table">
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={allVisiblePendingSelected}
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  aria-label="Seleccionar todas las ordenes pendientes visibles"
                />
              </TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Monto ($)</TableHead>
              <TableHead>Estado de Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const patientName = order.patients
                ? `${order.patients.first_name} ${order.patients.last_name}`.trim()
                : "Paciente no disponible";
              const isPending = order.payment_status === "pending";

              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      disabled={!isPending}
                      onChange={(event) => toggleRow(order.id, event.target.checked)}
                      aria-label={`Seleccionar orden ${order.order_seq ?? order.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-primary">
                    #{String(order.order_seq ?? "").padStart(4, "0")}
                  </TableCell>
                  <TableCell>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{patientName}</p>
                      <p className="text-xs text-muted-foreground">{order.patients?.id_number ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>${Number(order.total_amount).toFixed(2)}</TableCell>
                  <TableCell className="uppercase">{order.payment_status === "pending" ? "Pendiente" : "Pagada"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {ordersLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm italic text-muted-foreground">Cargando cuentas afiliadas...</p>
          </div>
        )}

        {!ordersLoading && orders.length === 0 && (
          <div className="py-20 text-center">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-sm text-muted-foreground">No hay ordenes para este afiliado con el filtro actual.</p>
          </div>
        )}

        <div className="space-y-2 p-2 md:hidden">
          {orders.map((order) => {
            const patientName = order.patients
              ? `${order.patients.first_name} ${order.patients.last_name}`.trim()
              : "Paciente no disponible";
            const isPending = order.payment_status === "pending";

            return (
              <div key={order.id} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-semibold text-primary">
                      #{String(order.order_seq ?? "").padStart(4, "0")}
                    </p>
                    <p className="text-sm font-medium">{patientName}</p>
                    <p className="text-xs text-muted-foreground">{order.patients?.id_number ?? ""}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    disabled={!isPending}
                    onChange={(event) => toggleRow(order.id, event.target.checked)}
                    aria-label={`Seleccionar orden ${order.order_seq ?? order.id}`}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{format(new Date(order.created_at), "dd/MM/yyyy")}</span>
                  <span>${Number(order.total_amount).toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs uppercase text-muted-foreground">{order.payment_status}</div>
              </div>
            );
          })}
        </div>

        <CardFooter className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
          {selectedPendingOrders.length} orden(es) pendientes seleccionadas para conciliacion.
        </CardFooter>
      </Card>

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>Cuenta de Cobro</DialogTitle>
            <DialogDescription>
              Revisa el soporte antes de imprimir o descargar el PDF para el laboratorio afiliado.
            </DialogDescription>
          </DialogHeader>
          <div className="h-full flex-1 overflow-hidden rounded-md border bg-muted">
            {selectedPendingOrders.length > 0 && selectedAffiliate ? (
              <PDFViewer width="100%" height="100%" className="border-none">
                <AffiliateAccountStatementPDF
                  affiliateName={selectedAffiliate.full_name || selectedAffiliate.email || "Afiliado"}
                  affiliateEmail={selectedAffiliate.email}
                  orders={selectedPendingOrders}
                  labData={labData}
                />
              </PDFViewer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">No hay ordenes seleccionadas para el soporte.</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setStatementOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
