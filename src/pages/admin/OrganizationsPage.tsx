import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, ToggleLeft, ToggleRight, Eye, EyeOff, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  getOrganizationMutationError,
  useCreateOrganization,
  useOrganizations,
  useToggleOrganizationActive,
  useToggleOrganizationSubscription,
} from "@/features/admin/useOrganizations";

interface OrgForm {
  org_name: string;
  country: string;
  state: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  rif: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

const emptyForm: OrgForm = {
  org_name: "",
  country: "",
  state: "",
  city: "",
  address: "",
  email: "",
  phone: "",
  rif: "",
  admin_full_name: "",
  admin_email: "",
  admin_password: "",
};

export default function OrganizationsPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OrgForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof OrgForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const { data: orgs = [], isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const toggleSubscription = useToggleOrganizationSubscription();
  const toggleActive = useToggleOrganizationActive();

  const isFormValid =
    form.org_name.trim() &&
    form.admin_full_name.trim() &&
    form.admin_email.trim() &&
    form.admin_password.trim() &&
    form.admin_password.length >= 6;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Laboratorios"
        description="Administra los laboratorios registrados en la plataforma."
        actions={
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo Laboratorio
          </Button>
        }
      />

      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Locacion</TableHead>
              <TableHead>Subscripcion</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : orgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay laboratorios registrados.
                </TableCell>
              </TableRow>
            ) : (
              orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      {org.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[org.city, org.state, org.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={(org).subscription_active ? "default" : "destructive"}
                      className="cursor-pointer"
                      onClick={() =>
                        toggleSubscription.mutate(
                          {
                            id: org.id,
                            subscription_active: (org).subscription_active ?? true,
                          },
                          {
                            onSuccess: () => toast.success("Subscription status updated"),
                            onError: (error) => toast.error(getOrganizationMutationError(error, "No se pudo actualizar la subscripcion")),
                          }
                        )
                      }
                    >
                      {(org).subscription_active ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(org.created_at!).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleActive.mutate(
                          { id: org.id, is_active: org.is_active ?? true },
                          {
                            onSuccess: () => toast.success("Status updated"),
                            onError: (error) => toast.error(getOrganizationMutationError(error, "No se pudo actualizar el estado")),
                          }
                        )
                      }
                    >
                      {org.is_active ? (
                        <ToggleRight className="w-4 h-4 text-primary" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Organization + Admin Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Laboratorio</DialogTitle>
            <DialogDescription>
              Crea un nuevo laboratorio y el usuario administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Organization Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Información del Laboratorio
              </h4>
              <div className="space-y-2">
                <Label>Nombre del Laboratorio *</Label>
                <Input placeholder="e.g. Central Medical Lab" value={form.org_name} onChange={set("org_name")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>País *</Label>
                  <Input placeholder="e.g. Venezuela" value={form.country} onChange={set("country")} />
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Input placeholder="e.g. Trujillo" value={form.state} onChange={set("state")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Ciudad *</Label>
                  <Input placeholder="e.g. Valera" value={form.city} onChange={set("city")} />
                </div>
                <div className="space-y-2">
                  <Label>RIF *</Label>
                  <Input placeholder="e.g. J-12345678-9" value={form.rif} onChange={set("rif")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="lab@lab.com" value={form.email} onChange={set("email")} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input placeholder="e.g. +58 123-456-7890" value={form.phone} onChange={set("phone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección *</Label>
                <Input placeholder="e.g. Av. Bolivar 1234" value={form.address} onChange={set("address")} />
              </div>
            </div>

            <Separator />

            {/* Admin User Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Administrador del Laboratorio
              </h4>
              <div className="space-y-2">
                <Label>Nombre Completo *</Label>
                <Input placeholder="e.g. Dr. Juan Pérez" value={form.admin_full_name} onChange={set("admin_full_name")} />
              </div>
              <div className="space-y-2">
                <Label>Correo *</Label>
                <Input type="email" placeholder="admin@lab.com" value={form.admin_email} onChange={set("admin_email")} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña * (6+ caracteres)</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.admin_password}
                    onChange={set("admin_password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                createOrg.mutate(form, {
                  onSuccess: () => {
                    toast.success("Organization & admin user created successfully");
                    setOpen(false);
                    setForm(emptyForm);
                  },
                  onError: (error) => toast.error(getOrganizationMutationError(error, "No se pudo crear el laboratorio")),
                })
              }
              disabled={!isFormValid || createOrg.isPending}
            >
              {createOrg.isPending ? "Creando..." : "Crear Laboratorio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
