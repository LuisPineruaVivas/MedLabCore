import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Ban, ChevronLeft, ChevronRight, MinusCircle, PlusCircle, Receipt, Scale } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { MovementDialog, type MovementDialogKind } from "@/features/erp/components/MovementDialog";
import { PeriodFilter } from "@/features/erp/components/ReportCharts";
import { TransferDialog } from "@/features/erp/components/TransferDialog";
import { useBankAccounts } from "@/features/erp/hooks/useBankAccounts";
import { useFinanceMovements, useVoidMovement } from "@/features/erp/hooks/useFinance";
import { formatCurrency } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { FINANCE_KIND_FILTERS, FINANCE_KIND_LABELS } from "@/features/erp/utils/finance";
import { buildPeriod, formatShortDate, isValidPeriod, type ReportPeriod } from "@/features/erp/utils/reports";
import type { FinanceEntry } from "@/features/erp/types";

const PAGE_SIZE = 50;
const ALL = "all";

export default function MovementsPage() {
  const { orgId } = useCurrentOrgContext();
  const { canManageFinances: isAdmin } = useErpModule();
  const [params, setParams] = useSearchParams();
  const accountId = params.get("account");
  const [period, setPeriod] = useState<ReportPeriod>(() => buildPeriod("this_month"));
  const [kind, setKind] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [movement, setMovement] = useState<MovementDialogKind | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voiding, setVoiding] = useState<FinanceEntry | null>(null);

  const { data: accounts = [] } = useBankAccounts(orgId);
  const validPeriod = isValidPeriod(period);
  const { data, isLoading, isFetching } = useFinanceMovements(orgId, {
    from: validPeriod ? period.from : null,
    to: validPeriod ? period.to : null,
    accountId,
    kind: kind === ALL ? null : kind,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showBalance = isAdmin && !!accountId;

  const setAccount = (value: string) => {
    setPage(1);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === ALL) next.delete("account"); else next.set("account", value);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Movimientos"
        description="Entradas y salidas de dinero: cobros de órdenes, gastos, otros ingresos y transferencias."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMovement("expense")}><MinusCircle className="mr-2 h-4 w-4" />Gasto</Button>
            <Button variant="outline" onClick={() => setMovement("income")}><PlusCircle className="mr-2 h-4 w-4" />Ingreso</Button>
            {isAdmin && <Button variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="mr-2 h-4 w-4" />Transferencia</Button>}
            {isAdmin && <Button variant="outline" onClick={() => setMovement("adjustment")}><Scale className="mr-2 h-4 w-4" />Ajuste</Button>}
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <PeriodFilter value={period} onChange={(value) => { setPeriod(value); setPage(1); }} />
        <Select value={accountId ?? ALL} onValueChange={setAccount}>
          <SelectTrigger className="w-52" aria-label="Cuenta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            {accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.currency}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(value) => { setKind(value); setPage(1); }}>
          <SelectTrigger className="w-48" aria-label="Tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {FINANCE_KIND_FILTERS.filter((item) => isAdmin || !item.adminOnly).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="max-sm:hidden">Cuenta</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {showBalance && <TableHead className="text-right max-sm:hidden">Saldo</TableHead>}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}>Cargando movimientos...</TableCell></TableRow>
            ) : rows.length ? (
              rows.map((row) => <MovementRow key={`${row.source}-${row.id}`} row={row} showBalance={showBalance} canVoid={isAdmin} onVoid={setVoiding} />)
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No hay movimientos para este filtro.
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

      <MovementDialog kind={movement} defaultAccountId={accountId} onOpenChange={(open) => !open && setMovement(null)} />
      <TransferDialog open={transferOpen} defaultFromId={accountId} onOpenChange={setTransferOpen} />
      <VoidMovementDialog entry={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function MovementRow({ row, showBalance, canVoid, onVoid }: { row: FinanceEntry; showBalance: boolean; canVoid: boolean; onVoid: (row: FinanceEntry) => void }) {
  const amount = Number(row.signed_amount);
  return (
    <TableRow className={row.is_void ? "text-muted-foreground" : undefined}>
      <TableCell className="whitespace-nowrap">{formatShortDate(row.entry_date)}</TableCell>
      <TableCell>
        <div className={row.is_void ? "line-through" : "font-medium"}>{row.description || row.category_name || FINANCE_KIND_LABELS[row.kind]}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Badge variant="outline">{FINANCE_KIND_LABELS[row.kind]}</Badge>
          {row.category_name && row.description && <span>{row.category_name}</span>}
          {row.reference_number && <span>· Ref. {row.reference_number}</span>}
          {row.currency !== "USD" && row.amount_usd != null && <span>· ≈ {formatCurrency(row.amount_usd)}</span>}
          {row.is_void && <span className="text-destructive">· Anulado: {row.void_reason}</span>}
          {row.invoice_id && <Link className="text-primary hover:underline" to={`/erp/invoices/${row.invoice_id}`}>· Ver factura</Link>}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap max-sm:hidden">{row.account_name}</TableCell>
      <TableCell className={`whitespace-nowrap text-right font-medium ${row.is_void ? "line-through" : amount < 0 ? "text-destructive" : "text-success"}`}>
        {amount > 0 ? "+" : ""}{formatCurrency(amount, row.currency)}
      </TableCell>
      {showBalance && <TableCell className="whitespace-nowrap text-right max-sm:hidden">{formatCurrency(row.running_balance, row.currency)}</TableCell>}
      <TableCell>
        {canVoid && row.source === "movement" && !row.is_void && (
          <Button variant="ghost" size="icon" aria-label="Anular movimiento" onClick={() => onVoid(row)}><Ban className="h-4 w-4" /></Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function VoidMovementDialog({ entry, onClose }: { entry: FinanceEntry | null; onClose: () => void }) {
  const { orgId } = useCurrentOrgContext();
  const voidMovement = useVoidMovement(orgId);
  const [reason, setReason] = useState("");
  const isTransfer = entry?.kind.startsWith("transfer");

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) { setReason(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Anular movimiento</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isTransfer ? "Se anulan las dos partes de la transferencia." : "El movimiento queda en el historial como anulado y deja de contar en el saldo."}
        </p>
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <Button
          variant="destructive"
          disabled={!reason.trim() || voidMovement.isPending}
          onClick={() =>
            entry && voidMovement.mutate({ id: entry.id, reason }, {
              onSuccess: () => { toast.success("Movimiento anulado."); setReason(""); onClose(); },
              onError: (error) => toast.error(getErpErrorMessage(error)),
            })
          }
        >
          {voidMovement.isPending ? "Anulando..." : "Anular"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
