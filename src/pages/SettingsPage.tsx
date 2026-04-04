import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Building2, Shield, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { OrganizationSettings } from "@/features/settings/OrganizationSettings";
import { ExchangeRateSettings } from "@/features/settings/ExchangeRateSettings";
import { TeamSettings } from "@/features/settings/TeamSettings";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const [activeDialog, setActiveDialog] = useState<"org" | "dept" | "users" | "exchange" | null>(null);
  const { orgId } = useCurrentOrgContext();
  const { signOut } = useAuth();

  const settingsCards = [
    {
      id: "org",
      icon: Building2,
      title: "Laboratorio",
      desc: "Nombre del laboratorio, logo, información de contacto, etc."
    },
    /*{ 
      id: "dept", 
      icon: Palette, 
      title: "Departamentos", 
      desc: "Configura los departamentos de tu laboratorio (Hematología, Bioquímica, etc.)" 
    },*/
    {
      id: "users",
      icon: Shield,
      title: "Usuarios y Roles",
      desc: "Gestiona el acceso del personal de tu laboratorio"
    },
    /*{ 
      id: "exchange", 
      icon: DollarSign, 
      title: "Tasa de Cambio", 
      desc: "Configura la tasa USD/BS para facturación en bolívares" 
    },*/
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Configuración"
        description="Configura tu laboratorio"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsCards.map((item) => (
          <div
            key={item.title}
            role="button"
            tabIndex={0}
            onClick={() => setActiveDialog(item.id as any)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveDialog(item.id as any); }}
            className="bg-card rounded-xl border border-border p-6 hover:border-primary/30 transition-all cursor-pointer group hover:shadow-md"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 md:mt-8 md:hidden">
        <button
          onClick={signOut}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>

      {/* Organization Dialog */}
      <Dialog open={activeDialog === "org"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-[600px] w-[90vw] md:w-full md:h-auto h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Datos del Laboratorio</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Configura el nombre, logo, información de contacto y otros detalles de tu laboratorio.</DialogDescription>
          </DialogHeader>
          {orgId ? (
            <OrganizationSettings orgId={orgId} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">Cargando...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Team / Users Dialog */}
      <Dialog open={activeDialog === "users"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usuarios y Roles</DialogTitle>
          </DialogHeader>
          {orgId ? (
            <TeamSettings orgId={orgId} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">Cargando...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Departments placeholder */}
      <Dialog open={activeDialog === "dept"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Próximamente</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Este módulo está en desarrollo.
          </div>
        </DialogContent>
      </Dialog>

      {/* Exchange Rate Dialog */}
      <Dialog open={activeDialog === "exchange"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-[450px] w-[95vw]">
          <DialogHeader>
            <DialogTitle>Tasa de Cambio USD / BS</DialogTitle>
          </DialogHeader>
          {orgId ? (
            <ExchangeRateSettings orgId={orgId} />
          ) : (
            <p className="text-sm text-muted-foreground py-4">Cargando...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
