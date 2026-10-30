import { useState } from "react";
import { Lock, ShieldAlert, CreditCard, LogOut, CheckCircle2, DollarSign, Upload, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useAuth } from "@/hooks/useAuth";
import { ReportPaymentDialog } from "./ReportPaymentDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SubscriptionLockScreen() {
  const { organization, subscriptionStatus } = useCurrentOrgContext();
  const { signOut, user } = useAuth();
  const [openReportModal, setOpenReportModal] = useState(false);

  const formattedExpiry = subscriptionStatus.expiresAt
    ? format(new Date(subscriptionStatus.expiresAt), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : "Fecha no disponible";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 text-slate-100">
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MedLabCore" className="h-10 w-10 object-contain bg-white rounded-lg p-1" />
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white">MedLabCore LIS</h1>
            <p className="text-[11px] text-slate-400">{organization?.name || "Laboratorio Clínico"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400">{user?.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs h-8"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto my-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Suscripción Suspendida
            </h2>
            <p className="text-xs text-slate-400">
              El período contratado finalizó el <strong>{formattedExpiry}</strong>.
            </p>
          </div>
        </div>

        <div className="my-6 space-y-3 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              Las operaciones del laboratorio (registro de órdenes, pacientes y carga de resultados) se encuentran temporalmente pausadas hasta validar tu renovación.
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>¡Desbloqueo inmediato con período de gracia!</strong> Al reportar tu comprobante, el sistema reactivará automáticamente el acceso por <strong>3 días</strong> mientras el Super Admin confirma la acreditación bancaria.
            </span>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Monto de Renovación
            </span>
            <div className="text-2xl font-extrabold text-white">
              ${Number(organization?.subscription_plan_price ?? 29).toFixed(2)} USD
              <span className="text-xs font-normal text-slate-400 ml-1.5">/ mes</span>
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => setOpenReportModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Reportar Pago Ahora
          </Button>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-500">
            ¿Tienes dudas o realizaste tu pago por otro canal? Contacta a soporte técnico de MedLabCore.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl w-full mx-auto text-center text-xs text-slate-600">
        MedLabCore LIS • Plataforma de Gestión de Laboratorio Clínico
      </div>

      <ReportPaymentDialog open={openReportModal} onOpenChange={setOpenReportModal} />
    </div>
  );
}
