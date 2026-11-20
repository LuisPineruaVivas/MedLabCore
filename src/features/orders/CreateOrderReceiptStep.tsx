import { useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { CalendarDays, CheckCircle2, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentScheduleForm } from "@/features/erp/components/PaymentScheduleForm";
import { useInvoice } from "@/features/erp/hooks/useInvoices";
import { useCreatePaymentSchedule, usePaymentSchedules } from "@/features/erp/hooks/usePaymentSchedules";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { OrderThermalReceiptPDF } from "@/lib/orderReceiptThermalPrinter";
import type { buildOrderReceiptData } from "./createOrderUtils";
import type { CreateOrderLabData } from "./useCreateOrderDialog";

/**
 * After creating the order: the delivery note, and beside it how the order gets paid
 * (pay now, or an installment plan), so the payment is settled before leaving the screen.
 * `invoiceId` is null when the order has nothing to collect here (no ERP, exempt, no permission).
 */
export function CreateOrderReceiptStep({
  receiptData,
  labData,
  invoiceId,
  onRegisterPayment,
  onClose,
}: {
  receiptData: ReturnType<typeof buildOrderReceiptData>;
  labData?: CreateOrderLabData;
  invoiceId: string | null;
  onRegisterPayment: () => void;
  onClose: () => void;
}) {
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances } = useErpModule();
  const { data: invoice } = useInvoice(invoiceId ?? undefined);
  const { data: schedules = [] } = usePaymentSchedules(invoiceId ?? undefined);
  const createSchedule = useCreatePaymentSchedule(orgId, invoiceId ?? undefined);
  const [planOpen, setPlanOpen] = useState(false);
  const balance = invoice ? Number(invoice.balance_due_usd) : null;
  const activePlan = schedules.filter((item) => item.status !== "cancelled").length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary" />
          Nota de Entrega
        </DialogTitle>
        <DialogDescription>Imprima o descargue esta nota para el paciente.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="h-[60dvh] w-full overflow-hidden rounded-lg border border-border sm:h-[70vh]">
          <PDFViewer width="100%" height="100%" showToolbar>
            <OrderThermalReceiptPDF
              orderId={receiptData.order_seq ?? ""}
              orderDate={receiptData.orderDate}
              patientName={receiptData.patientName}
              patientId={receiptData.patientId}
              age={receiptData.age}
              gender={receiptData.gender}
              items={receiptData.items}
              total={receiptData.total}
              accessPin={receiptData.accessPin}
              portalUrl={`${window.location.origin}/portal-paciente`}
              labData={labData}
              exchangeRate={receiptData.exchangeRate}
              totalBs={receiptData.totalBs}
            />
          </PDFViewer>
        </div>

        {/* First on phones, so the actions don't sit below a tall note. */}
        <aside className="order-first flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:order-none">
          <div>
            <p className="text-sm text-muted-foreground">Total de la orden</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(receiptData.total)}</p>
            {balance !== null && balance > 0 && balance < receiptData.total && (
              <p className="text-sm">Saldo pendiente: <b className="tabular-nums">{formatCurrency(balance)}</b></p>
            )}
          </div>

          {invoiceId && balance !== null && (balance <= 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />Orden pagada
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">¿Cómo paga el paciente?</p>
              <Button onClick={onRegisterPayment}>
                <Wallet className="mr-1 h-4 w-4" />Registrar pago
              </Button>
              {canManageFinances && (activePlan > 0 ? (
                <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4" />Plan de {activePlan} cuota(s) creado</p>
              ) : (
                <Button variant="outline" onClick={() => setPlanOpen(true)}>
                  <CalendarDays className="mr-1 h-4 w-4" />Pagar en cuotas
                </Button>
              ))}
              <p className="text-xs text-muted-foreground">
                Si cobra después, la orden queda en <b>Administración → Por cobrar</b> con su saldo.
              </p>
            </>
          ))}

          <Button variant={invoiceId && balance !== null && balance > 0 ? "ghost" : "default"} className="sm:mt-auto" onClick={onClose}>
            Cerrar
          </Button>
        </aside>
      </div>

      {invoiceId && balance !== null && (
        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pagar en cuotas</DialogTitle></DialogHeader>
            <PaymentScheduleForm
              balance={balance}
              pending={createSchedule.isPending}
              onSubmit={(items) =>
                createSchedule.mutate(items, {
                  onSuccess: () => {
                    toast.success("Plan de cuotas creado.");
                    setPlanOpen(false);
                  },
                  onError: (error) => toast.error(getErpErrorMessage(error)),
                })
              }
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
