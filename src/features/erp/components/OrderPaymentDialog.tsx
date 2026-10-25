import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useBankAccounts } from "../hooks/useBankAccounts";
import { useInvoice } from "../hooks/useInvoices";
import { useRegisterPayments } from "../hooks/usePayments";
import { getErpErrorMessage } from "../utils/erpErrors";
import { PaymentForm } from "./PaymentForm";

export function OrderPaymentDialog({ invoiceId, open, onOpenChange }: { invoiceId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { orgId } = useCurrentOrgContext();
  const { data: invoice } = useInvoice(invoiceId ?? undefined);
  const { data: accounts = [] } = useBankAccounts(orgId, true);
  const { data: liveRate } = useExchangeRate(orgId);
  const register = useRegisterPayments(orgId, invoiceId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Registrar pago de la orden</DialogTitle></DialogHeader>
        {invoice && (
          <PaymentForm
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
