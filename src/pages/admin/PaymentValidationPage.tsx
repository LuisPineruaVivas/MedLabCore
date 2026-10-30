import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminSubscriptionPayments,
  useApproveSubscriptionPayment,
  useRejectSubscriptionPayment,
} from "@/features/subscription/useAdminSubscriptions";
import type { SubscriptionPayment, SubscriptionPaymentStatus } from "@/types/subscription";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  Loader2,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";

export default function PaymentValidationPage() {
  const [tabFilter, setTabFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: payments = [], isLoading } = useAdminSubscriptionPayments(
    tabFilter === "all" ? undefined : tabFilter
  );

  const approveMutation = useApproveSubscriptionPayment();
  const rejectMutation = useRejectSubscriptionPayment();

  // Dialog state for reviewing/viewing proof
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPayment | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);

  // Dialog state for approving
  const [approvePaymentId, setApprovePaymentId] = useState<string | null>(null);

  // Dialog state for rejecting
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleOpenApprove = (payment: SubscriptionPayment) => {
    setApprovePaymentId(payment.id);
  };

  const handleConfirmApprove = async () => {
    if (!approvePaymentId) return;
    try {
      await approveMutation.mutateAsync(approvePaymentId);
      setApprovePaymentId(null);
      if (proofModalOpen) setProofModalOpen(false);
    } catch {
      // error handled by hook
    }
  };

  const handleOpenReject = (payment: SubscriptionPayment) => {
    setRejectPaymentId(payment.id);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectPaymentId) return;
    try {
      await rejectMutation.mutateAsync({ paymentId: rejectPaymentId, reason: rejectionReason });
      setRejectPaymentId(null);
      setRejectionReason("");
      if (proofModalOpen) setProofModalOpen(false);
    } catch {
      // error handled by hook
    }
  };

  // Filter by search term
  const filteredPayments = payments.filter((p) => {
    const orgName = p.organizations?.name?.toLowerCase() || "";
    const ref = p.reference_number?.toLowerCase() || "";
    const term = searchTerm.toLowerCase();
    return orgName.includes(term) || ref.includes(term);
  });

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Validación de Pagos de Suscripción"
        description="Revisa los comprobantes de pago enviados por los laboratorios, aprueba renovaciones o rechaza con motivo."
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tabs */}
        <Tabs value={tabFilter} onValueChange={(val) => setTabFilter(val as any)}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="pending" className="text-xs">
              Pendientes
              {pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Aprobados
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              Rechazados
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              Todos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por laboratorio o referencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border border-border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Laboratorio</TableHead>
              <TableHead className="text-xs font-semibold">Fecha Reporte</TableHead>
              <TableHead className="text-xs font-semibold">Método & Ref</TableHead>
              <TableHead className="text-xs font-semibold">Monto</TableHead>
              <TableHead className="text-xs font-semibold">Comprobante</TableHead>
              <TableHead className="text-xs font-semibold">Estado</TableHead>
              <TableHead className="text-right text-xs font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  Cargando bandeja de validación...
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
                  No se encontraron pagos en esta categoría.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((p) => (
                <TableRow key={p.id} className="text-xs">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-foreground block">
                          {p.organizations?.name || "Laboratorio"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {p.organizations?.rif ? `RIF: ${p.organizations.rif}` : p.organizations?.email || ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{format(new Date(p.payment_date || p.created_at), "dd/MM/yyyy")}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="capitalize font-medium block">{p.payment_method.replace("_", " ")}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">Ref: {p.reference_number}</span>
                  </TableCell>

                  <TableCell>
                    <span className="font-bold text-foreground block">${Number(p.amount_usd).toFixed(2)} USD</span>
                    {p.amount_bs && (
                      <span className="text-[10px] text-muted-foreground block">
                        Bs. {Number(p.amount_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPayment(p);
                        setProofModalOpen(true);
                      }}
                      className="h-7 text-xs border-dashed gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Captura
                    </Button>
                  </TableCell>

                  <TableCell>
                    {p.status === "approved" ? (
                      <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobado
                      </Badge>
                    ) : p.status === "rejected" ? (
                      <div>
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="w-3 h-3 mr-1" /> Negado
                        </Badge>
                        {p.rejection_reason && (
                          <span className="block text-[10px] text-destructive/80 mt-1 max-w-[150px] truncate" title={p.rejection_reason}>
                            {p.rejection_reason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px]">
                        <Clock className="w-3 h-3 mr-1" /> Pendiente
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {p.status === "pending" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenApprove(p)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Aprobar (+30d)
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenReject(p)}
                          className="h-7 text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Negar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPayment(p);
                          setProofModalOpen(true);
                        }}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        Detalles
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Comprobante Ampliado */}
      <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {selectedPayment && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="text-base font-bold">
                      Comprobante de Pago - {selectedPayment.organizations?.name || "Laboratorio"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Referencia: <strong className="font-mono">{selectedPayment.reference_number}</strong> • Método:{" "}
                      <span className="capitalize">{selectedPayment.payment_method.replace("_", " ")}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Imagen / Preview */}
              <div className="my-2 bg-slate-950 rounded-xl p-2 flex items-center justify-center min-h-[300px] border border-border">
                {selectedPayment.proof_url.toLowerCase().endsWith(".pdf") ? (
                  <div className="text-center p-8 space-y-3">
                    <p className="text-sm text-slate-300">Este comprobante es un archivo PDF.</p>
                    <Button asChild size="sm">
                      <a href={selectedPayment.proof_url} target="_blank" rel="noreferrer">
                        Abrir PDF en pestaña nueva <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <img
                    src={selectedPayment.proof_url}
                    alt="Comprobante ampliado"
                    className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-lg"
                  />
                )}
              </div>

              {/* Detalles adicionales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/40 p-3 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Monto USD</span>
                  <span className="font-bold text-foreground">${Number(selectedPayment.amount_usd).toFixed(2)}</span>
                </div>
                {selectedPayment.amount_bs && (
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Monto VES</span>
                    <span className="font-bold text-foreground">
                      Bs. {Number(selectedPayment.amount_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block text-[10px]">Fecha Transacción</span>
                  <span className="font-medium">
                    {format(new Date(selectedPayment.payment_date || selectedPayment.created_at), "dd/MM/yyyy")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Estado</span>
                  <span className="font-semibold capitalize">{selectedPayment.status}</span>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="text-xs bg-muted/20 p-2.5 rounded-lg border border-border">
                  <span className="font-semibold block text-[11px] text-muted-foreground">Nota del Laboratorio:</span>
                  <p className="text-foreground mt-0.5">{selectedPayment.notes}</p>
                </div>
              )}

              {selectedPayment.status === "pending" && (
                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProofModalOpen(false);
                      handleOpenReject(selectedPayment);
                    }}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Negar Pago
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setProofModalOpen(false);
                      handleOpenApprove(selectedPayment);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Aprobar y Sumar 30 Días
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Aprobación */}
      <Dialog open={!!approvePaymentId} onOpenChange={(open) => !open && setApprovePaymentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <DialogTitle className="text-base font-bold">Confirmar Aprobación de Pago</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Al aprobar este pago, el sistema sumará automáticamente <strong>30 días</strong> a la fecha de
              expiración del laboratorio y desbloqueará el servicio de inmediato.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovePaymentId(null)}
              disabled={approveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmApprove}
              disabled={approveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Aprobando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar Aprobación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Negación con Motivo Obligatorio */}
      <Dialog open={!!rejectPaymentId} onOpenChange={(open) => !open && setRejectPaymentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-base font-bold">Negar Reporte de Pago</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Por favor indique el motivo del rechazo. El administrador del laboratorio podrá leer esta observación en su
              panel para corregir y subir un nuevo comprobante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Motivo del Rechazo *</Label>
            <Textarea
              placeholder="Ej. El número de referencia no coincide con los estados de cuenta recibidos hoy..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="text-xs resize-none"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectPaymentId(null)}
              disabled={rejectMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Negar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
