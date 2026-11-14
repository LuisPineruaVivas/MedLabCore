import { useState } from "react";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useOrgSubscriptionPayments } from "./useSubscriptionPayments";
import { ReportPaymentDialog } from "./ReportPaymentDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Plus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SubscriptionSettingsCard() {
  const { orgId, organization, subscriptionStatus } = useCurrentOrgContext();
  const { data: payments = [], isLoading: isLoadingPayments } = useOrgSubscriptionPayments(orgId);
  const [openModal, setOpenModal] = useState(false);

  const priceUsd = Number(organization?.subscription_plan_price ?? 29.0);
  const { expiresAt, graceUntil, isExpired, isInGrace, isWarning, daysRemaining, hoursRemaining } =
    subscriptionStatus;

  // Format dates
  const formattedExpiry = expiresAt
    ? format(new Date(expiresAt), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : "Sin fecha registrada";

  const formattedGrace = graceUntil
    ? format(new Date(graceUntil), "dd 'de' MMMM, HH:mm", { locale: es })
    : null;

  // Last approved payment
  const lastApprovedPayment = payments.find((p) => p.status === "approved");

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div
        className="rounded-xl border border-border bg-card p-6 transition-all"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Plan Mensual MedLabCore</h3>
                {isExpired && !isInGrace ? (
                  <Badge variant="destructive" className="text-xs">
                    Vencida
                  </Badge>
                ) : isInGrace ? (
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    Período de Gracia
                  </Badge>
                ) : isWarning ? (
                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    Por Vencer
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    Activa
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Costo del servicio: <strong>${priceUsd.toFixed(2)} USD / mes</strong> (o en Bs a tasa del día)
              </p>
            </div>
          </div>

          <Button onClick={() => setOpenModal(true)} size="sm" className="shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" /> Reportar Pago
          </Button>
        </div>

        {/* Countdown & Key Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cuenta Regresiva */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Tiempo Restante</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            {isExpired && !isInGrace ? (
              <div>
                <span className="text-2xl font-bold text-destructive">0 días</span>
                <p className="text-xs text-destructive/80 mt-1">Suscripción vencida</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-foreground">{daysRemaining}</span>
                  <span className="text-xs text-muted-foreground">días restantes</span>
                  <span className="text-xs text-muted-foreground">({hoursRemaining} horas)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isInGrace ? "Hasta fin de gracia" : "Hasta próxima fecha de corte"}
                </p>
              </div>
            )}
          </div>

          {/* Fecha de Expiración */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Vencimiento</span>
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">{formattedExpiry}</span>
              {formattedGrace && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                  Gracia hasta: {formattedGrace}
                </p>
              )}
            </div>
          </div>

          {/* Último Pago Aprobado */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Último Pago Validado</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              {lastApprovedPayment ? (
                <>
                  <span className="text-sm font-bold text-foreground">
                    ${Number(lastApprovedPayment.amount_usd).toFixed(2)} USD
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Aprobado el{" "}
                    {format(new Date(lastApprovedPayment.created_at), "dd/MM/yyyy", { locale: es })}
                  </p>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Sin pagos previos registrados</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Pagos Enviados */}
      <div
        className="rounded-xl border border-border bg-card p-6 transition-all"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">Historial de Reportes de Pago</h4>
            <p className="text-xs text-muted-foreground">
              Comprobantes enviados y su estado de validación por parte del Super Administrador.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold">Método</TableHead>
                <TableHead className="text-xs font-semibold">Referencia</TableHead>
                <TableHead className="text-xs font-semibold">Monto</TableHead>
                <TableHead className="text-xs font-semibold">Comprobante</TableHead>
                <TableHead className="text-xs font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPayments ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs py-6 text-muted-foreground">
                    Cargando reportes de pago...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs py-6 text-muted-foreground">
                    No has reportado ningún pago aún. Haz clic en "Reportar Pago" para subir tu primer comprobante.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id} className="text-xs">
                    <TableCell className="font-medium">
                      {format(new Date(payment.payment_date || payment.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_method.replace("_", " ")}</TableCell>
                    <TableCell className="font-mono">{payment.reference_number}</TableCell>
                    <TableCell>
                      <span className="font-semibold">${Number(payment.amount_usd).toFixed(2)} USD</span>
                      {payment.amount_bs && (
                        <span className="block text-[10px] text-muted-foreground">
                          Bs. {Number(payment.amount_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={payment.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        Ver imagen <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {payment.status === "approved" ? (
                          <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobado
                          </Badge>
                        ) : payment.status === "rejected" ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="w-3 h-3 mr-1" /> Negado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px]">
                            <Clock className="w-3 h-3 mr-1" /> En Revisión
                          </Badge>
                        )}

                        {payment.status === "rejected" && payment.rejection_reason && (
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] mt-1 max-w-xs">
                            <strong>Motivo:</strong> {payment.rejection_reason}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ReportPaymentDialog open={openModal} onOpenChange={setOpenModal} />
    </div>
  );
}
