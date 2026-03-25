import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  FlaskConical,
  Globe,
  Building2,
  DollarSign,
  Pencil,
  Copy,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TestTemplateRow } from "@/features/tests/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function TestsTemplatesPage() {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<TestTemplateRow | null>(null);

  // ── Fetch user profile for org_id ──────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

  // ── Fetch templates ────────────────────────────────────────
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["test-templates", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TestTemplateRow[];
    },
    enabled: !!user,
  });

  // ── Mutations ──────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("test_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("test_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
      toast.success("Plantilla eliminada correctamente");
      setTemplateToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Handlers ───────────────────────────────────────────────
  function handleNew() {
    navigate("/admin/tests-templates/new");
  }

  function handleEdit(tpl: TestTemplateRow) {
    const isGlobal = tpl.org_id === null;

    if (!isSuperAdmin && isGlobal) {
      // Lab admin forks: navigate with ?fork=1
      navigate(`/admin/tests-templates/${tpl.id}/edit?fork=1`);
    } else {
      navigate(`/admin/tests-templates/${tpl.id}/edit`);
    }
  }

  // ── Derived ────────────────────────────────────────────────
  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  const categoryColors: Record<string, string> = {
    Hematologia: "bg-destructive/10 text-destructive",
    Uroanalisis: "bg-warning/10 text-warning",
    Bioquimica: "bg-info/10 text-info",
    Endocrinologia: "bg-success/10 text-success",
    Microbiologia: "bg-primary/10 text-primary",
    Immunologia: "bg-accent text-accent-foreground",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Plantillas de Examenes de Laboratorio"
        description="Administra las plantillas de examenes disponibles para los pacientes"
        actions={
          (isSuperAdmin || role === "lab_admin") && (
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Plantilla
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar plantillas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead>Campos</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No hay plantillas que mostrar
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tpl) => {
                const isGlobal = tpl.org_id === null;
                const fieldCount =
                  tpl.schema?.sections?.reduce(
                    (acc: number, s: { fields?: unknown[] }) => acc + (s.fields?.length ?? 0),
                    0
                  ) ?? 0;
                const canEdit =
                  isSuperAdmin || (role === "lab_admin" && (isGlobal || tpl.org_id === orgId));

                return (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{tpl.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          categoryColors[tpl.category] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tpl.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isGlobal ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Globe className="w-3 h-3" /> Global
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Building2 className="w-3 h-3" /> Custom
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fieldCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-success" />
                        <span className="text-sm font-semibold mono">
                          {Number(tpl.base_price).toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        className="inline-flex items-center"
                        onClick={() =>
                          (isSuperAdmin || tpl.org_id === orgId) &&
                          toggleMutation.mutate({ id: tpl.id, is_active: !tpl.is_active })
                        }
                        disabled={!isSuperAdmin && tpl.org_id !== orgId}
                      >
                        {tpl.is_active ? (
                          <ToggleRight className="w-5 h-5 text-success" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleEdit(tpl)}
                          >
                            {isGlobal && !isSuperAdmin ? (
                              <>
                                <Copy className="w-3 h-3" /> Personalizar
                              </>
                            ) : (
                              <>
                                <Pencil className="w-3 h-3" /> Editar
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setTemplateToDelete(tpl);
                            }}
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
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

      <Dialog open={!!templateToDelete} onOpenChange={(v) => !v && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar plantilla?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la plantilla <strong>{templateToDelete?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (templateToDelete) {
                  deleteMutation.mutate(templateToDelete.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
