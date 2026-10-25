import { Building2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBackfillInvoices, useBackfillPreview } from "@/features/erp/hooks/useInvoices";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { useErpModule } from "@/hooks/useErpModule";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";

export function ErpModuleToggle() {
  const { isErpEnabled, canManageFinances } = useErpModule();
  const { organization, orgId } = useCurrentOrgContext();

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Módulo Administrativo & ERP
              {isErpEnabled ? (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Activo en tu Plan
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" /> Plan Estándar
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Control financiero, inventario perpetuo (Kardex), costeo automático por examen y cierres de caja.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 text-xs text-muted-foreground">
        {isErpEnabled ? (
          <p className="text-emerald-700 dark:text-emerald-400">
            ✓ Tu laboratorio <span className="font-semibold">{organization?.name}</span> tiene habilitadas todas las funciones de administración, finanzas, cobros mixtos e inventario.
          </p>
        ) : (
          <p>
            ℹ️ Las funciones de inventario y facturación avanzada están reservadas para planes avanzados. Si deseas activarlo para tu laboratorio, contacta al soporte de MedLabCore.
          </p>
        )}
      </div>

      {isErpEnabled && canManageFinances && <RetroactiveInvoices orgId={orgId} />}
    </div>
  );
}

/** Lets the lab admin create invoices for orders made before the module was enabled. */
function RetroactiveInvoices({ orgId }: { orgId: string | null }) {
  const { data: pending = 0, isLoading } = useBackfillPreview(orgId, true);
  const backfill = useBackfillInvoices(orgId);
  const [confirming, setConfirming] = useState(false);

  if (isLoading || pending === 0) return null;

  function handleConfirm() {
    backfill.mutate(undefined, {
      onSuccess: (created) => {
        toast.success(`Se generaron ${created} factura(s) retroactiva(s).`);
        setConfirming(false);
      },
      onError: (error) => toast.error(getErpErrorMessage(error)),
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm">
      <p className="font-medium">Órdenes anteriores sin factura: {pending.toLocaleString("es-VE")}</p>
      <p className="text-xs text-muted-foreground">
        Puedes generar sus facturas para verlas en cuentas por cobrar y reportes. Las órdenes pagadas quedan como facturas pagadas;
        las demás quedan emitidas con su saldo completo para que registres los abonos.
      </p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>¿Generar {pending} factura(s)? No se puede deshacer.</span>
          <Button size="sm" onClick={handleConfirm} disabled={backfill.isPending}>{backfill.isPending ? "Generando..." : "Sí, generar"}</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={backfill.isPending}>Cancelar</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Generar facturas retroactivas</Button>
      )}
    </div>
  );
}
