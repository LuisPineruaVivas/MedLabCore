import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Users, Shield, FlaskConical, ClipboardList } from "lucide-react";
import { useCreateTeamMember, useTeamMembers } from "./useTeamSettings";

const roleLabels: Record<string, string> = {
  lab_admin: "Administrador",
  bioanalyst: "Bioanalista",
  secretary: "Secretaria",
  lab_affiliate: "Laboratorio Afiliado",
};

const roleIcons: Record<string, typeof Shield> = {
  lab_admin: Shield,
  bioanalyst: FlaskConical,
  secretary: ClipboardList,
  lab_affiliate: Shield,
};

const roleColors: Record<string, string> = {
  lab_admin: "border-primary/20 bg-primary/10 text-primary",
  bioanalyst: "border-success/20 bg-success/10 text-success",
  secretary: "border-warning/20 bg-warning/10 text-warning",
  lab_affiliate: "border-sky-200 bg-sky-100 text-sky-700",
};

interface TeamSettingsProps {
  orgId: string;
}

export function TeamSettings({ orgId }: TeamSettingsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "secretary" });

  const { data: members = [], isLoading } = useTeamMembers(orgId);
  const createUser = useCreateTeamMember(orgId);

  const handleCreateUser = () => {
    createUser.mutate(form, {
      onSuccess: () => {
        setAddOpen(false);
        setForm({ email: "", password: "", full_name: "", role: "secretary" });
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{members.length} miembros</span>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Agregar Miembro
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando equipo...</div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No hay miembros registrados</div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role] ?? Shield;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-xs font-bold text-primary">
                      {(member.full_name || member.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.full_name || "Sin nombre"}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`flex-shrink-0 gap-1 text-xs ${roleColors[member.role] ?? ""}`}>
                  <RoleIcon className="h-3 w-3" />
                  {roleLabels[member.role] ?? member.role}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Agregar Miembro al Equipo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input
                placeholder="Ej: Dra. Maria Garcia"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo Electronico</Label>
              <Input
                type="email"
                placeholder="maria@laboratorio.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contrasena</Label>
              <Input
                type="password"
                placeholder="********"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bioanalyst">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-3.5 w-3.5" />
                      Bioanalista
                    </div>
                  </SelectItem>
                  <SelectItem value="secretary">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Secretaria
                    </div>
                  </SelectItem>
                  <SelectItem value="lab_affiliate">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      Laboratorio Afiliado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {form.role === "bioanalyst"
                  ? "Puede ingresar resultados de examenes. No tiene acceso a facturacion ni precios."
                  : form.role === "lab_affiliate"
                    ? "Puede registrar pacientes y crear ordenes a credito para cobro posterior. No puede ver configuraciones ni reportes generales."
                    : "Puede crear ordenes y gestionar pacientes. No puede ingresar resultados ni configurar examenes."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!form.email || !form.password || !form.full_name || createUser.isPending}
            >
              {createUser.isPending ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
