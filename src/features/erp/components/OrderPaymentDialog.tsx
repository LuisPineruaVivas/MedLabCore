import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useInvoice } from "../hooks/useInvoices";
import { useRegisterPayments } from "../hooks/usePayments";
import { getErpErrorMessage } from "../utils/erpErrors";
import { PaymentForm } from "./PaymentForm";

interface OrderPaymentDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** USD amount pre-filled in the first payment (e.g. an installment). */
  suggestedUsd?: number | null;
  title?: string;
}

export function OrderPaymentDialog({ invoiceId, open, onOpenChange, suggestedUsd, title = "Registrar pago de la orden" }: OrderPaymentDialogProps) {
  const { orgId } = useCurrentOrgContext();
  const { data: invoice } = useInvoice(invoiceId ?? undefined);
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const { data: liveRate } = useExchangeRate(orgId);
  const register = useRegisterPayments(orgId, invoiceId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {invoice && !accounts.length && <p className="text-sm text-muted-foreground">Cargando cuentas… Si no aparece ninguna, un administrador debe crear una cuenta activa.</p>}
        {invoice && accounts.length > 0 && (
          <PaymentForm
            key={`${invoice.id}-${suggestedUsd ?? ""}`}
            suggestedUsd={suggestedUsd}
            accounts={accounts}
            balance={Number(invoice.balance_due_usd)}
            defaultRate={liveRate?.rate ?? invoice.exchange_rate}
            pending={register.isPending}
            onSubmit={(items) =>
              register.mutate(items, {
                onSuccess: () => {
                  toast.success("Pago registrado.");
                  onOpenChange(false);
                },
                onError: (error) => toast.error(getErpErrorMessage(error)),
              })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
