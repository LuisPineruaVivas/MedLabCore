import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Copy, DollarSign, FlaskConical, Globe, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TestTemplateRow } from "@/features/tests/schemas";
import { getAdminTemplateError, useAdminTestTemplates, useDeleteAdminTestTemplate, useToggleAdminTestTemplate } from "@/features/admin/useAdminTestTemplates";

const categoryColors: Record<string, string> = {
  Hematologia: "bg-destructive/10 text-destructive",
  Uroanalisis: "bg-warning/10 text-warning",
  Bioquimica: "bg-info/10 text-info",
  Endocrinologia: "bg-success/10 text-success",
  Microbiologia: "bg-primary/10 text-primary",
  Immunologia: "bg-accent text-accent-foreground",
};

export default function TestsTemplatesPage() {
  const { orgId } = useCurrentOrgContext();
  const { role, isSuperAdmin } = useUserRole();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<TestTemplateRow | null>(null);

  const { data: templates = [], isLoading } = useAdminTestTemplates();
  const toggleMutation = useToggleAdminTestTemplate();
  const deleteMutation = useDeleteAdminTestTemplate();

  const filtered = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.category.toLowerCase().includes(search.toLowerCase())
  );

  function handleEdit(template: TestTemplateRow) {
    const isGlobal = template.org_id === null;
    navigate(!isSuperAdmin && isGlobal ? `/admin/tests-templates/${template.id}/edit?fork=1` : `/admin/tests-templates/${template.id}/edit`);
  }

  function handleToggle(template: TestTemplateRow) {
    if (!isSuperAdmin && template.org_id !== orgId) return;

    toggleMutation.mutate(
      { id: template.id, is_active: !template.is_active },
      {
        onError: (error) => toast.error(getAdminTemplateError(error, "No se pudo actualizar la plantilla")),
      }
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Plantilla eliminada correctamente");
        setTemplateToDelete(null);
      },
      onError: (error) => {
        toast.error(getAdminTemplateError(error, "No se pudo eliminar la plantilla"));
      },
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Plantillas de Examenes de Laboratorio"
        description="Administra las plantillas de examenes disponibles para los pacientes"
        actions={
          (isSuperAdmin || role === "lab_admin") && (
            <Button onClick={() => navigate("/admin/tests-templates/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Plantilla
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar plantillas" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Ambito</TableHead>
              <TableHead>Campos</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay plantillas que mostrar
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((template) => {
                const isGlobal = template.org_id === null;
                const fieldCount =
                  template.schema?.sections?.reduce(
                    (acc: number, section: { fields?: unknown[] }) => acc + (section.fields?.length ?? 0),
                    0
                  ) ?? 0;
                const canEdit = isSuperAdmin || (role === "lab_admin" && (isGlobal || template.org_id === orgId));

                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{template.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColors[template.category] ?? "bg-muted text-muted-foreground"}`}>
                        {template.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isGlobal ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Globe className="h-3 w-3" />
                          Global
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          Custom
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fieldCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-success" />
                        <span className="mono text-sm font-semibold">{Number(template.base_price).toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button className="inline-flex items-center" onClick={() => handleToggle(template)} disabled={!isSuperAdmin && template.org_id !== orgId}>
                        {template.is_active ? (
                          <ToggleRight className="h-5 w-5 text-success" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEdit(template)}>
                            {isGlobal && !isSuperAdmin ? <Copy className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                            {isGlobal && !isSuperAdmin ? "Personalizar" : "Editar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setTemplateToDelete(template)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar plantilla</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la plantilla <strong>{templateToDelete?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => templateToDelete && handleDelete(templateToDelete.id)}>
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
