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
};

const roleIcons: Record<string, typeof Shield> = {
  lab_admin: Shield,
  bioanalyst: FlaskConical,
  secretary: ClipboardList,
};

const roleColors: Record<string, string> = {
  lab_admin: "bg-primary/10 text-primary border-primary/20",
  bioanalyst: "bg-success/10 text-success border-success/20",
  secretary: "bg-warning/10 text-warning border-warning/20",
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
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{members.length} miembros</span>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          Agregar Miembro
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando equipo...</div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No hay miembros registrados</div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const RoleIcon = roleIcons[m.role] ?? Shield;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`gap-1 text-xs flex-shrink-0 ${roleColors[m.role] ?? ""}`}>
                  <RoleIcon className="w-3 h-3" />
                  {roleLabels[m.role] ?? m.role}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[420px] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Agregar Miembro al Equipo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input placeholder="Ej: Dra. María García" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input type="email" placeholder="maria@laboratorio.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bioanalyst">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Bioanalista
                    </div>
                  </SelectItem>
                  <SelectItem value="secretary">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Secretaria
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {form.role === "bioanalyst"
                  ? "Puede ingresar resultados de exámenes. No tiene acceso a facturación ni precios."
                  : "Puede crear órdenes y gestionar pacientes. No puede ingresar resultados ni configurar exámenes."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateUser}
              disabled={!form.email || !form.password || !form.full_name || createUser.isPending}
            >
              {createUser.isPending ? "Creando…" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
