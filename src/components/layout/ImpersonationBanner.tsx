import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Loader2, Building2, User } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation, isLoading } = useImpersonation();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-slate-950 px-4 py-2.5 shadow-md border-b border-amber-600 animate-in fade-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-amber-600/30">
            <ShieldAlert className="w-5 h-5 text-slate-950 animate-pulse" />
          </div>
          <div>
            <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-600/40 px-1.5 py-0.5 rounded mr-2">
              Modo Soporte Activo
            </span>
            <span>
              Estás navegando como{" "}
              <strong className="font-semibold text-slate-950 underline decoration-slate-900/40">
                {impersonatedUser.name}
              </strong>{" "}
              ({impersonatedUser.email})
            </span>
            {impersonatedUser.org_name && (
              <span className="hidden md:inline ml-2 text-slate-900/80">
                • Lab: <strong>{impersonatedUser.org_name}</strong>
              </span>
            )}
            <span className="ml-2 font-mono text-[11px] bg-slate-950/10 px-1.5 py-0.5 rounded">
              Rol: {impersonatedUser.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            variant="destructive"
            onClick={stopImpersonation}
            disabled={isLoading}
            className="bg-slate-950 hover:bg-slate-900 text-white font-medium text-xs h-8 px-3 shadow-sm border border-slate-800"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            )}
            <span>Volver a mi cuenta Super Admin</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
