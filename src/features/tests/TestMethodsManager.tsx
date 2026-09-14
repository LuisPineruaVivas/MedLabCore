import { useState } from "react";
import { Copy, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { type TestMethod, useDeleteTestMethod, useSaveTestMethod, useTestMethods } from "./useTestMethods";

type EditingMethod = Pick<TestMethod, "id" | "org_id" | "name" | "description" | "is_active">;

export function TestMethodsManager({ canManage, isSuperAdmin = false }: { canManage: boolean; isSuperAdmin?: boolean }) {
  const { data: methods = [], isLoading } = useTestMethods();
  const saveMethod = useSaveTestMethod();
  const deleteMethod = useDeleteTestMethod();
  const [editing, setEditing] = useState<EditingMethod | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TestMethod | null>(null);

  const openCreate = () => {
    setEditing({ id: "", org_id: "local", name: "", description: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (method: TestMethod) => {
    setEditing(method);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!editing?.name.trim()) {
      toast.error("El nombre del método es obligatorio.");
      return;
    }

    try {
      await saveMethod.mutateAsync({
        id: editing.org_id === null && !isSuperAdmin ? undefined : editing.id || undefined,
        forkOfGlobalId: editing.org_id === null && !isSuperAdmin ? editing.id : null,
        name: editing.name,
        description: editing.description,
        isActive: editing.is_active,
      });
      toast.success(editing.org_id === null && !isSuperAdmin ? "Método personalizado creado" : "Método guardado correctamente");
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "No se pudo guardar el método"));
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMethod.mutateAsync(confirmDelete.id);
      toast.success("Método eliminado");
      setConfirmDelete(null);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "No se pudo eliminar el método"));
    }
  };

  return (
    <>
      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-5 w-5 text-primary" />Métodos de examen</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Seleccionables al cargar resultados e impresos en el informe.</p>
          </div>
          {canManage && <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Nuevo método</Button>}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Cargando métodos...</p> : methods.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay métodos disponibles.</p>
          ) : (
            <div className="divide-y">
              {methods.map((method) => {
                const isGlobal = method.org_id === null;
                return (
                  <div key={method.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{method.name}</p>{isGlobal && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Predeterminado</span>}{!method.is_active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Inactivo</span>}</div>
                      {method.description && <p className="mt-1 text-sm text-muted-foreground">{method.description}</p>}
                    </div>
                    {canManage && <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(method)}>{isGlobal ? <Copy className="mr-1 h-3.5 w-3.5" /> : <Pencil className="mr-1 h-3.5 w-3.5" />}{isGlobal ? "Personalizar" : "Editar"}</Button>
                      {(!isGlobal || isSuperAdmin) && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setConfirmDelete(method)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.org_id === null && !isSuperAdmin ? "Personalizar método predeterminado" : editing?.id ? "Editar método" : "Nuevo método"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {editing?.org_id === null && !isSuperAdmin && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Se creará una copia propia para tu laboratorio; el método predeterminado no se modificará.</p>}
            <div className="space-y-2"><Label htmlFor="method-name">Nombre</Label><Input id="method-name" value={editing?.name ?? ""} onChange={(event) => setEditing((current) => current ? { ...current, name: event.target.value } : current)} autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="method-description">Descripción (opcional)</Label><Textarea id="method-description" value={editing?.description ?? ""} onChange={(event) => setEditing((current) => current ? { ...current, description: event.target.value } : current)} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing?.is_active ?? true} onChange={(event) => setEditing((current) => current ? { ...current, is_active: event.target.checked } : current)} />Disponible para asignar</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saveMethod.isPending}>{saveMethod.isPending ? "Guardando..." : "Guardar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent><DialogHeader><DialogTitle>¿Eliminar método?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Las órdenes existentes conservarán el nombre histórico del método.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button><Button variant="destructive" onClick={remove} disabled={deleteMethod.isPending}>Eliminar</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  );
}
