import { useState } from "react";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CreditCard, ChevronRight } from "lucide-react";
import { ReportPaymentDialog } from "./ReportPaymentDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SubscriptionBanner() {
  const { subscriptionStatus, role } = useCurrentOrgContext();
  const [openModal, setOpenModal] = useState(false);

  // Super admin never needs to see this banner
  if (role === "super_admin") {
    return null;
  }

  const { isWarning, isInGrace, daysRemaining, hoursRemaining, expiresAt, graceUntil } = subscriptionStatus;

  // Only display if warning (<= 3 days remaining) or in grace period
  if (!isWarning && !isInGrace) {
    return null;
  }

  const formattedExpiry = expiresAt
    ? format(new Date(expiresAt), "dd 'de' MMMM", { locale: es })
    : "";

  const formattedGrace = graceUntil
    ? format(new Date(graceUntil), "dd 'de' MMMM, HH:mm", { locale: es })
    : "";

  return (
    <>
      {isInGrace ? (
        // Banner de período de gracia (informando que el pago está en revisión)
        <div className="w-full bg-blue-600/15 border-b border-blue-500/30 text-blue-900 dark:text-blue-200 px-4 py-2.5 transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-blue-500/20 flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div>
                <span className="font-bold mr-1.5 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20">
                  Pago en Verificación
                </span>
                <span>
                  Período de gracia activo hasta el <strong>{formattedGrace}</strong>. Tienes acceso completo al sistema mientras el Super Admin confirma la acreditación.
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenModal(true)}
              className="h-7 text-xs border-blue-500/40 hover:bg-blue-500/20 text-blue-900 dark:text-blue-100 flex-shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              Ver o Subir Nuevo Pago
            </Button>
          </div>
        </div>
      ) : (
        // Banner de advertencia preventiva (<= 3 días restantes)
        <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 px-4 py-2.5 transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-amber-500/20 flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="font-bold mr-1.5 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20">
                  Aviso de Vencimiento
                </span>
                <span>
                  Tu suscripción expira en{" "}
                  <strong>
                    {daysRemaining === 0 ? `pocas horas (${hoursRemaining}h)` : `${daysRemaining} día(s)`}
                  </strong>{" "}
                  ({formattedExpiry}). Reporta tu pago para evitar la suspensión operativa del laboratorio.
                </span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setOpenModal(true)}
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium flex-shrink-0 shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              Reportar Pago Ahora ($29 USD)
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <ReportPaymentDialog open={openModal} onOpenChange={setOpenModal} />
    </>
  );
}
