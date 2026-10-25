import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CalendarDays, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useInvoice } from "@/features/erp/hooks/useInvoices";
import { useBankAccounts } from "@/features/erp/hooks/useBankAccounts";
import { usePayments, useRegisterPayments, useVoidPayment } from "@/features/erp/hooks/usePayments";
import { useCreatePaymentSchedule, usePaymentSchedules } from "@/features/erp/hooks/usePaymentSchedules";
import { PaymentForm } from "@/features/erp/components/PaymentForm";
import { PaymentScheduleForm } from "@/features/erp/components/PaymentScheduleForm";
import { InvoiceStatusBadge } from "@/features/erp/components/InvoiceStatusBadge";
import type { Payment } from "@/features/erp/types";
import { formatCurrency, formatExchangeRate } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances, canRegisterPayments } = useErpModule();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const { data: payments = [] } = usePayments(id);
  const { data: schedules = [] } = usePaymentSchedules(id);
  const { data: liveRate } = useExchangeRate(orgId);
  const register = useRegisterPayments(orgId, id);
  const voidPayment = useVoidPayment(orgId, id);
  const createSchedule = useCreatePaymentSchedule(orgId, id);
  const [dialog, setDialog] = useState<"payment" | "schedule" | null>(null);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState("");

  if (isLoading) return <p className="text-muted-foreground">Cargando factura...</p>;
  if (!invoice) return <p>Factura no encontrada.</p>;
  const payable = invoice.status === "issued" || invoice.status === "partial" || invoice.status === "overdue";

  function handleVoid() {
    if (!voiding || !voidReason.trim()) return;
    voidPayment.mutate(
      { paymentId: voiding.id, reason: voidReason.trim() },
      {
        onSuccess: () => {
          toast.success("Pago anulado. El saldo de la factura se actualizó.");
          setVoiding(null);
          setVoidReason("");
        },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      }
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={invoice.invoice_number}
        description={`Orden #${invoice.orders?.order_seq ?? "—"}`}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/erp/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link></Button>
            {canRegisterPayments && payable && (
              <Button onClick={() => setDialog("payment")}><CreditCard className="mr-2 h-4 w-4" />Registrar pago</Button>
            )}
          </>
        }
      />
      <section className="max-w-2xl space-y-5 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Paciente</p>
            <p className="font-medium">{invoice.patients ? `${invoice.patients.first_name} ${invoice.patients.last_name}` : "—"}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 border-y py-4 text-sm">
          <div><p className="text-muted-foreground">Total USD</p><p className="text-lg font-semibold">{formatCurrency(invoice.total_usd)}</p></div>
          <div><p className="text-muted-foreground">Saldo pendiente</p><p className="text-lg font-semibold">{formatCurrency(invoice.balance_due_usd)}</p></div>
          <div><p className="text-muted-foreground">Total VES</p><p>{formatCurrency(invoice.total_local, "VES")}</p></div>
          <div><p className="text-muted-foreground">Tasa aplicada</p><p>Bs. {formatExchangeRate(invoice.exchange_rate)}</p></div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pagos</h2>
            <span className="text-sm text-muted-foreground">{payments.filter((payment) => !payment.is_void).length} registrados</span>
          </div>
          <div className="mt-2 divide-y">
            {payments.length ? (
              payments.map((payment) => (
                <div className="flex items-center justify-between gap-2 py-2 text-sm" key={payment.id}>
                  <div className={payment.is_void ? "text-muted-foreground line-through" : undefined}>
                    <p>{payment.payment_method}{payment.reference_number ? ` · ${payment.reference_number}` : ""}</p>
                    <p className="text-xs text-muted-foreground no-underline">{new Date(payment.payment_date).toLocaleString("es-VE")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={payment.is_void ? "text-muted-foreground line-through" : undefined}>{formatCurrency(payment.amount, payment.currency)}</p>
                      {payment.is_void && <p className="text-xs text-destructive">Anulado: {payment.void_reason}</p>}
                    </div>
                    {canManageFinances && !payment.is_void && (
                      <Button size="icon" variant="ghost" title="Anular pago" onClick={() => setVoiding(payment)}>
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-2 text-sm text-muted-foreground">Sin pagos registrados.</p>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Plan de cuotas</h2>
            {canManageFinances && payable && (
              <Button size="sm" variant="outline" onClick={() => setDialog("schedule")}>
                <CalendarDays className="mr-1 h-4 w-4" />{schedules.length ? "Recrear" : "Crear"}
              </Button>
            )}
          </div>
          <div className="mt-2 divide-y">
            {schedules.length ? (
              schedules.map((schedule) => (
                <div className="flex justify-between py-2 text-sm" key={schedule.id}>
                  <span>Cuota {schedule.installment_number} · {schedule.due_date}{schedule.notes ? ` · ${schedule.notes}` : ""}</span>
                  <span>{formatCurrency(schedule.amount_paid_usd)} / {formatCurrency(schedule.amount_due_usd)}</span>
                </div>
              ))
            ) : (
              <p className="py-2 text-sm text-muted-foreground">No hay cuotas programadas.</p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={dialog === "payment"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <PaymentForm
            accounts={accounts}
            balance={Number(invoice.balance_due_usd)}
            defaultRate={liveRate?.rate ?? invoice.exchange_rate}
            pending={register.isPending}
            onSubmit={(items) =>
              register.mutate(items, {
                onSuccess: () => setDialog(null),
                onError: (error) => toast.error(getErpErrorMessage(error)),
              })
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "schedule"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Plan de cuotas</DialogTitle></DialogHeader>
          <PaymentScheduleForm
            balance={Number(invoice.balance_due_usd)}
            pending={createSchedule.isPending}
            onSubmit={(items) =>
              createSchedule.mutate(items, {
                onSuccess: () => setDialog(null),
                onError: (error) => toast.error(getErpErrorMessage(error)),
              })
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog open={!!voiding} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular pago</DialogTitle>
            <DialogDescription>
              {voiding && `${voiding.payment_method} por ${formatCurrency(voiding.amount, voiding.currency)}. El pago queda en el historial marcado como anulado.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Motivo de la anulación (obligatorio)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={!voidReason.trim() || voidPayment.isPending}>
              {voidPayment.isPending ? "Anulando..." : "Anular pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
