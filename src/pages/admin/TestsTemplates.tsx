import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { TemplateBuilderDialog } from "@/features/tests/TemplateBuilderDialog";
import {
  TestTemplateFormData,
  TestTemplateRow,
  TemplateJsonSchema,
} from "@/features/tests/schemas";

export default function TestsTemplatesPage() {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestTemplateRow | null>(null);
  const [forking, setForking] = useState(false);

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
  const saveMutation = useMutation({
    mutationFn: async ({
      formData,
      id,
      targetOrgId,
    }: {
      formData: TestTemplateFormData;
      id?: string;
      targetOrgId: string | null;
    }) => {
      const row = {
        name: formData.name,
        category: formData.category,
        base_price: formData.base_price,
        schema: formData.schema as unknown as import("@/integrations/supabase/types").Json,
        org_id: targetOrgId,
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabase
          .from("test_templates")
          .update(row)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("test_templates")
          .insert([row]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-templates"] });
      toast.success(editing ? "Template updated" : "Template created");
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

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

  // ── Handlers ───────────────────────────────────────────────
  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForking(false);
  }

  function handleNew() {
    setEditing(null);
    setForking(false);
    setDialogOpen(true);
  }

  function handleEdit(tpl: TestTemplateRow) {
    const isGlobal = tpl.org_id === null;
    const isOwn = tpl.org_id === orgId;

    if (isSuperAdmin) {
      // Super admin edits directly
      setEditing(tpl);
      setForking(false);
    } else if (isGlobal) {
      // Lab admin forks global template
      setEditing(tpl);
      setForking(true);
    } else if (isOwn) {
      // Lab admin edits own
      setEditing(tpl);
      setForking(false);
    }
    setDialogOpen(true);
  }

  function handleSave(data: TestTemplateFormData) {
    if (forking) {
      // Clone: insert new row with this org's id
      saveMutation.mutate({ formData: data, targetOrgId: orgId! });
    } else if (editing) {
      // Update existing
      saveMutation.mutate({
        formData: data,
        id: editing.id,
        targetOrgId: isSuperAdmin && editing.org_id === null ? null : orgId ?? null,
      });
    } else {
      // New
      saveMutation.mutate({
        formData: data,
        targetOrgId: isSuperAdmin ? null : orgId ?? null,
      });
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

  const editingFormData: TestTemplateFormData | undefined = editing
    ? {
        name: editing.name,
        category: editing.category,
        base_price: Number(editing.base_price),
        schema: editing.schema,
      }
    : undefined;

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
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Builder Dialog */}
      <TemplateBuilderDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          if (!v) closeDialog();
          else setDialogOpen(v);
        }}
        onSave={handleSave}
        initialData={editingFormData}
        isSaving={saveMutation.isPending}
        title={
          forking
            ? "Personalizar Plantilla"
            : editing
            ? "Editar Plantilla"
            : "Nueva Plantilla de Examen"
        }
      />
    </div>
  );
}
