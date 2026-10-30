import { useState } from "react";
import { Building2, LogOut, BadgeCheck, Shield, CreditCard } from "lucide-react";
import { DialogDescription } from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationSettings } from "@/features/settings/OrganizationSettings";
import { ExchangeRateSettings } from "@/features/settings/ExchangeRateSettings";
import { TeamSettings } from "@/features/settings/TeamSettings";
import { ProfileSettings } from "@/features/settings/ProfileSettings";
import { SubscriptionSettingsCard } from "@/features/subscription/SubscriptionSettingsCard";

type SettingsDialog = "org" | "dept" | "users" | "exchange" | "profile" | "subscription" | null;

export default function SettingsPage() {
  const [activeDialog, setActiveDialog] = useState<SettingsDialog>(null);
  const { orgId, role, user, subscriptionStatus } = useCurrentOrgContext();
  const { signOut } = useAuth();

  const mapRoles = (role: string | null) => {
    switch (role) {
      case "lab_admin":
        return "Administrador";
      case "bioanalyst":
        return "Bioanalista";
      case "secretary":
        return "Secretaria";
      default:
        return "Super Admin";
    }
  };

  const settingsCards =
    role === "bioanalyst"
      ? [
          {
            id: "profile" as const,
            icon: BadgeCheck,
            title: "Configuracion de Perfil",
            desc: "Sube tu firma y sello para aprobar y firmar resultados.",
          },
        ]
      : [
          {
            id: "subscription" as const,
            icon: CreditCard,
            title: "Suscripción y Pagos",
            desc: `Estado: ${subscriptionStatus.statusText}. Administra tu membresía y reportes de pago.`,
          },
          {
            id: "org" as const,
            icon: Building2,
            title: "Laboratorio",
            desc: "Nombre del laboratorio, logo, informacion de contacto, etc.",
          },
          {
            id: "users" as const,
            icon: Shield,
            title: "Usuarios y Roles",
            desc: "Gestiona el acceso del personal de tu laboratorio",
          },
        ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Configuracion"
        description={role === "bioanalyst" ? "Administra tu firma y sello profesional" : "Configura tu laboratorio y suscripción"}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div
          className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 transition-colors group-hover:bg-primary/15">
            <BadgeCheck className="h-5 w-5 text-primary" />
          </div>
          <h3 className="mb-1 text-sm font-semibold truncate">Usuario: {user?.email || "email no disponible"}</h3>
          <p className="text-xs text-muted-foreground">Rol: {mapRoles(role)}</p>
          <div className="mt-2 md:mt-8">
            <button
              onClick={signOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-2 text-destructive transition-colors hover:bg-destructive/10 md:w-auto"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Cerrar sesion</span>
            </button>
          </div>
        </div>

        {settingsCards.map((item) => (
          <div
            key={item.title}
            role="button"
            tabIndex={0}
            onClick={() => setActiveDialog(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setActiveDialog(item.id);
              }
            }}
            className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 transition-colors group-hover:bg-primary/15">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 text-sm font-semibold">{item.title}</h3>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Dialog Suscripción */}
      <Dialog open={activeDialog === "subscription"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>Módulo de Suscripción y Pagos</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Consulta el estado de tu licencia, vigencia restante y envía comprobantes de renovación.
            </DialogDescription>
          </DialogHeader>
          <SubscriptionSettingsCard />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "org"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="h-[90vh] w-[90vw] overflow-y-auto md:h-auto md:w-full sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Datos del Laboratorio</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configura el nombre, logo, informacion de contacto y otros detalles de tu laboratorio.
            </DialogDescription>
          </DialogHeader>
          {orgId ? <OrganizationSettings orgId={orgId} /> : <p className="py-4 text-sm text-muted-foreground">Cargando...</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "users"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Usuarios y Roles</DialogTitle>
          </DialogHeader>
          {orgId ? <TeamSettings orgId={orgId} /> : <p className="py-4 text-sm text-muted-foreground">Cargando...</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "profile"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Configuracion de Perfil</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configura la firma y el sello que se insertaran al completar una orden.
            </DialogDescription>
          </DialogHeader>
          {user?.id ? <ProfileSettings userId={user.id} /> : <p className="py-4 text-sm text-muted-foreground">Cargando...</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "dept"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proximamente</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">Este modulo esta en desarrollo.</div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "exchange"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Tasa de Cambio USD / BS</DialogTitle>
          </DialogHeader>
          {orgId ? <ExchangeRateSettings orgId={orgId} /> : <p className="py-4 text-sm text-muted-foreground">Cargando...</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
