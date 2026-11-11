import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Landmark, MinusCircle, Pencil, Plus, PlusCircle, Scale } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { BankAccountForm } from "@/features/erp/components/BankAccountForm";
import { MovementDialog, type MovementDialogKind } from "@/features/erp/components/MovementDialog";
import { TransferDialog } from "@/features/erp/components/TransferDialog";
import { useBankAccounts, useSaveBankAccount } from "@/features/erp/hooks/useBankAccounts";
import { useAccountBalances } from "@/features/erp/hooks/useFinance";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { withLiveUsd } from "@/features/erp/utils/finance";
import { PAYMENT_METHOD_LABELS } from "@/features/erp/utils/paymentMethods";
import type { BankAccount } from "@/features/erp/types";

// Admin-only route (App.tsx): balances are not shown to other roles.
export default function AccountsPage() {
  const { orgId } = useCurrentOrgContext();
  const { data: accounts = [], isLoading } = useBankAccounts(orgId);
  const { data: rawBalances = [] } = useAccountBalances(orgId);
  const { data: liveRate } = useExchangeRate(orgId);
  const balances = withLiveUsd(rawBalances, liveRate?.rate);
  const save = useSaveBankAccount(orgId);
  const [editing, setEditing] = useState<BankAccount | null | undefined>();
  const [movement, setMovement] = useState<MovementDialogKind | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const balanceOf = (id: string) => balances.find((item) => item.account_id === id);
  const activeBalances = balances.filter((item) => item.is_active);
  const totalUsd = activeBalances.reduce((sum, item) => sum + Number(item.balance_usd ?? 0), 0);
  const missingRate = activeBalances.some((item) => item.balance_usd === null);
  const byCurrency = Object.entries(
    activeBalances.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.currency]: (acc[item.currency] ?? 0) + Number(item.balance) }), {}),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cuentas"
        description="Dinero del laboratorio en cada cuenta. Los cobros de órdenes, gastos y transferencias actualizan el saldo."
        actions={<Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Nueva cuenta</Button>}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Total disponible (aprox. en USD)</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(totalUsd)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {byCurrency.map(([currency, total]) => formatCurrency(total, currency)).join(" · ") || "Sin cuentas"}
            {missingRate && " · falta la tasa del día para convertir algunas cuentas"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button variant="outline" onClick={() => setMovement("expense")}><MinusCircle className="mr-2 h-4 w-4" />Gasto</Button>
          <Button variant="outline" onClick={() => setMovement("income")}><PlusCircle className="mr-2 h-4 w-4" />Ingreso</Button>
          <Button variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="mr-2 h-4 w-4" />Transferencia</Button>
          <Button variant="outline" onClick={() => setMovement("adjustment")}><Scale className="mr-2 h-4 w-4" />Ajuste</Button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Cargando cuentas...</p>
        ) : accounts.length ? (
          accounts.map((account) => {
            const balance = balanceOf(account.id);
            return (
              <article key={account.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-5 ${account.is_active ? "" : "opacity-60"}`}>
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /><h2 className="font-semibold">{account.name}</h2></div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[account.method_type] ?? account.method_type} · {account.currency}
                      {account.bank_name ? ` · ${account.bank_name}` : ""}{account.is_active ? "" : " · Inactiva"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Editar ${account.name}`} onClick={() => setEditing(account)}><Pencil className="h-4 w-4" /></Button>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${Number(balance?.balance ?? 0) < 0 ? "text-destructive" : ""}`}>{formatCurrency(balance?.balance ?? account.opening_balance, account.currency)}</p>
                  {account.currency !== "USD" && balance?.balance_usd != null && <p className="text-xs text-muted-foreground">≈ {formatCurrency(balance.balance_usd)}</p>}
                </div>
                <Link className="text-sm font-medium text-primary hover:underline" to={`/erp/movements?account=${account.id}`}>Ver movimientos</Link>
              </article>
            );
          })
        ) : (
          <p className="text-muted-foreground">No hay cuentas. Crea la primera con su saldo inicial.</p>
        )}
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle></DialogHeader>
          {editing !== undefined && (
            <BankAccountForm
              key={editing?.id ?? "new"}
              account={editing}
              pending={save.isPending}
              onSubmit={(values) =>
                save.mutate({ id: editing?.id, values }, {
                  onSuccess: () => { toast.success(editing ? "Cuenta actualizada." : "Cuenta creada."); setEditing(undefined); },
                  onError: (error) => toast.error(getErpErrorMessage(error, "No se pudo guardar la cuenta.")),
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
      <MovementDialog kind={movement} onOpenChange={(open) => !open && setMovement(null)} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
