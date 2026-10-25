import { useState } from "react";
import { Landmark, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { BankAccountForm } from "@/features/erp/components/BankAccountForm";
import { useBankAccounts, useSaveBankAccount } from "@/features/erp/hooks/useBankAccounts";
import type { BankAccount } from "@/features/erp/types";

export default function BankAccountsPage() {
  const { orgId } = useCurrentOrgContext(); const { canManageFinances } = useErpModule();
  const { data: accounts = [], isLoading } = useBankAccounts(orgId); const save = useSaveBankAccount(orgId);
  const [editing, setEditing] = useState<BankAccount | null | undefined>();
  return <div className="space-y-6 animate-fade-in"><PageHeader title="Métodos de cobro" description="Configura las cuentas y métodos disponibles para recibir pagos." actions={canManageFinances ? <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Nuevo método</Button> : undefined} />
    <div className="grid gap-3 md:grid-cols-2">{isLoading ? <p className="text-muted-foreground">Cargando métodos...</p> : accounts.length ? accounts.map((account) => <article key={account.id} className="rounded-xl border bg-card p-5 flex justify-between gap-3"><div><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /><h2 className="font-semibold">{account.name}</h2></div><p className="mt-1 text-sm text-muted-foreground">{account.method_type.replace("_", " ")} · {account.currency} {account.bank_name ? `· ${account.bank_name}` : ""}</p><p className="mt-2 text-xs">{account.is_active ? "Activo" : "Inactivo"}</p></div>{canManageFinances && <Button variant="ghost" size="icon" onClick={() => setEditing(account)}><Pencil className="h-4 w-4" /></Button>}</article>) : <p className="text-muted-foreground">No hay métodos configurados.</p>}</div>
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar método" : "Nuevo método de cobro"}</DialogTitle></DialogHeader><BankAccountForm account={editing} pending={save.isPending} onSubmit={(values) => save.mutate({ id: editing?.id, values }, { onSuccess: () => setEditing(undefined) })} /></DialogContent></Dialog>
  </div>;
}
