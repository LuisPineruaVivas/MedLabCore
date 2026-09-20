import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/hooks/useUserRole";
import { getAdminUserError, useAdminOrganizationsList, useAdminUsers, useCreateAdminUser } from "@/features/admin/useAdminUsers";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAuth } from "@/hooks/useAuth";

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", org_id: "", role: "lab_admin" as UserRole });
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const { data: orgs = [] } = useAdminOrganizationsList();
  const { data: users = [], isLoading } = useAdminUsers();
  const createUser = useCreateAdminUser();
  const { startImpersonation, isLoading: isImpersonatingLoading } = useImpersonation();
  const { user: currentUser } = useAuth();

  const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    super_admin: "destructive",
    lab_admin: "default",
    bioanalyst: "secondary",
    secretary: "outline",
    lab_affiliate: "secondary",
  };

  const handleImpersonate = async (userId: string, userName: string) => {
    try {
      setImpersonatingId(userId);
      await startImpersonation(userId);
    } catch {
      // Error handled by startImpersonation toast
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        description="Administra los usuarios de la plataforma y asume su identidad para soporte"
        actions={
          <Button onClick={() => setOpen(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-1.5" /> Agregar Usuario
          </Button>
        }
      />

      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Organización</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Cargando usuarios…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isThisLoading = impersonatingId === u.id && isImpersonatingLoading;

                return (
                  <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[u.role] ?? "outline"}>
                        {u.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.organizations?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.created_at!).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonate(u.id, u.full_name || u.email || "Usuario")}
                          disabled={isImpersonatingLoading}
                          className="h-8 text-xs font-medium text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                          title="Iniciar sesión como este usuario para soporte"
                        >
                          {isThisLoading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <LogIn className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                          )}
                          <span>Iniciar sesión como</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input placeholder="Dr. John Smith" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="john@lab.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={form.org_id} onValueChange={(v) => setForm({ ...form, org_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab_admin">Lab Admin</SelectItem>
                  <SelectItem value="bioanalyst">Bioanalyst</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="lab_affiliate">Lab Affiliate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                createUser.mutate(form, {
                  onSuccess: () => {
                    toast.success("User created successfully");
                    setOpen(false);
                    setForm({ email: "", password: "", full_name: "", org_id: "", role: "lab_admin" });
                  },
                  onError: (error) => toast.error(getAdminUserError(error, "No se pudo crear el usuario")),
                })
              }
              disabled={!form.email || !form.password || !form.full_name || !form.org_id || createUser.isPending}
            >
              {createUser.isPending ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
