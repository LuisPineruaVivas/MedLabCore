import { Fragment, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Plus, Search, FlaskConical, DollarSign,
  Pencil, Copy, ToggleLeft, ToggleRight, Eye,
  ChevronRight,
  Package, Trash2, ListOrdered
} from "lucide-react";
import { toast } from "sonner";
import { TestTemplateFormData, TestTemplateRow } from "@/features/tests/schemas";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { TestReportPDF } from "@/lib/testReportGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { StatCard } from "@/components/ui/StatCard";
import { ProfileBuilderDialog } from "@/features/tests/ProfileBuilderDialog";
import { cn } from "@/lib/utils";
import type { ExamProfileRow } from "@/features/tests/profileSchemas";
import { ExamOrderView } from "@/features/tests/ExamOrderView";

export default function TestsPage() {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<"exams" | "profiles" | "order">("exams");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [previewTpl, setPreviewTpl] = useState<TestTemplateRow | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isMobileDevice = () =>
    typeof window !== "undefined" &&
    (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  async function handleViewTemplatePreview(template: TestTemplateRow) {
    if (isMobileDevice()) {
      setPreviewLoading(true);
      try {
        const blob = await pdf(
          <TestReportPDF
            template={template}
            labData={{
              name: lab?.name || "Nombre del Laboratorio",
              address: lab?.address || "Dirección desde Perfil",
              phone: lab?.phone || "Teléfono desde Perfil",
              email: lab?.email || "Correo desde Perfil",
              logo: lab?.logo_url || null,
              primary_color: lab?.primary_color || "#0ea5e9",
              secondary_color: lab?.secondary_color || "#4f46e5",
            }}
          />
        ).toBlob();

        if (blob) {
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
          toast.error("No se pudo generar el PDF");
        }
      } catch (error) {
        toast.error("Error al generar el PDF");
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewTpl(template);
      setIsPreviewOpen(true);
    }
  }

  // Profile state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    name: string;
    description: string | null;
    total_price: number;
    template_ids: string[];
  } | null>(null);


  const debouncedSearch = useDebounce(search, 500);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const orgId = profile?.org_id;

  const { data: lab } = useQuery({
    queryKey: ["lab", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orgId,
  });

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["test-templates", orgId, debouncedSearch, page],
    queryFn: async () => {
      if (!orgId) return { items: [], total: 0 };
      const offset = (page - 1) * pageSize;
      const searchTerm = debouncedSearch.trim();

      let query = supabase
        .from("v_test_templates_filtered")
        .select("*", { count: "exact" })
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .order("name");

      if (searchTerm) {
        const searchFilter = `%${searchTerm}%`;
        query = query.or(`name.ilike.${searchFilter},category.ilike.${searchFilter}`);
      }

      const { data, error, count } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;

      return { items: (data ?? []) as TestTemplateRow[], total: count ?? 0 };
    },
    enabled: !!user && !!orgId,
  });

  const templates = templatesData?.items ?? [];
  const totalTemplates = templatesData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalTemplates / pageSize));

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("test_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["test-templates"] }),
  });

  function handleNew() {
    navigate("/tests/templates/new");
  }

  function handleEdit(tpl: TestTemplateRow) {
    const isGlobal = tpl.org_id === null;

    // Only navigate
    if (!isSuperAdmin && isGlobal) {
      // Fork
      navigate(`/tests/templates/${tpl.id}/edit?fork=1`);
    } else {
      // Edit
      navigate(`/tests/templates/${tpl.id}/edit`);
    }
  }

  // ── Profile queries & mutations ──
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["exam-profiles", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase)
        .from("exam_profiles")
        .select("*, profile_templates_junction(template_id)")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as (ExamProfileRow & { profile_templates_junction: { template_id: string }[] })[];
    },
    enabled: !!orgId && activeTab === "profiles",
  });

  const profileSaveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      description: string;
      total_price: number;
      template_ids: string[];
    }) => {
      if (payload.id) {
        // Update profile
        const { error: updateErr } = await (supabase)
          .from("exam_profiles")
          .update({
            name: payload.name,
            description: payload.description || null,
            total_price: payload.total_price,
          })
          .eq("id", payload.id);
        if (updateErr) throw updateErr;

        // Delete old junctions and re-insert
        const { error: delErr } = await (supabase)
          .from("profile_templates_junction")
          .delete()
          .eq("profile_id", payload.id);
        if (delErr) throw delErr;

        if (payload.template_ids.length > 0) {
          const { error: insErr } = await (supabase)
            .from("profile_templates_junction")
            .insert(payload.template_ids.map((tid) => ({
              profile_id: payload.id!,
              template_id: tid,
            })));
          if (insErr) throw insErr;
        }
      } else {
        // Create new profile
        const { data: newProfile, error: createErr } = await (supabase)
          .from("exam_profiles")
          .insert({
            org_id: orgId!,
            name: payload.name,
            description: payload.description || null,
            total_price: payload.total_price,
          })
          .select("id")
          .single();
        if (createErr) throw createErr;

        if (payload.template_ids.length > 0) {
          const { error: juncErr } = await (supabase)
            .from("profile_templates_junction")
            .insert(payload.template_ids.map((tid) => ({
              profile_id: newProfile.id,
              template_id: tid,
            })));
          if (juncErr) throw juncErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-profiles"] });
      toast.success("Perfil guardado correctamente");
      setProfileDialogOpen(false);
      setEditingProfile(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const profileDeleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await (supabase)
        .from("exam_profiles")
        .delete()
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-profiles"] });
      toast.success("Perfil eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const profileToggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase)
        .from("exam_profiles")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam-profiles"] }),
  });

  function handleEditProfile(profile: ExamProfileRow & { profile_templates_junction: { template_id: string }[] }) {
    setEditingProfile({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      total_price: Number(profile.total_price),
      template_ids: profile.profile_templates_junction.map(j => j.template_id),
    });
    setProfileDialogOpen(true);
  }

  const filtered = templates;

  const categoryColors: Record<string, string> = {
    Hematologia: "bg-destructive/10 text-destructive",
    Uroanalisis: "bg-warning/10 text-warning",
    Bioquimica: "bg-info/10 text-info",
    Endocrinologia: "bg-success/10 text-success",
    Microbiologia: "bg-primary/10 text-primary",
    Immunologia: "bg-accent text-accent-foreground",
    Serologia: "bg-muted/10 text-muted",
    Coagulacion: "bg-destructive/10 text-destructive",
    PruebasEspeciales: "bg-warning/10 text-warning",
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["test-templates-stats", orgId],
    queryFn: async () => {

      const [tests, activeTests, profiles] = await Promise.all([
        supabase
          .from("v_test_templates_filtered")
          .select("is_active, org_id")
          .or(`org_id.is.null,org_id.eq.${orgId}`),

        supabase
          .from("v_test_templates_filtered")
          .select("is_active, org_id")
          .eq("is_active", true)
          .or(`org_id.is.null,org_id.eq.${orgId}`),

        supabase
          .from("exam_profiles")
          .select("is_active, org_id")
          .or(`org_id.is.null,org_id.eq.${orgId}`),
      ]);

      const total = tests.data.length ?? 0;
      const active = activeTests.data.length ?? 0;
      const global = profiles.data.length ?? 0;

      return { total, active, global };
    },
    enabled: !!user && !!orgId,
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Examenes de laboratorio"
        description="Define y personaliza los examenes disponibles en tu laboratorio"
        actions={
          (isSuperAdmin || role === "lab_admin") && (
            <div className="flex items-center gap-2">
              {activeTab === "profiles" ? (
                <Button onClick={() => { setEditingProfile(null); setProfileDialogOpen(true); }} size="sm">
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Nuevo Perfil</span>
                  <span className="sm:hidden">Nuevo Perfil</span>
                </Button>
              ) : (
                <Button onClick={handleNew} size="sm">
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Nuevo Examen</span>
                  <span className="sm:hidden">Nuevo Examen</span>
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Statistics Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4">
        <StatCard
          title="Total Examenes"
          value={statsLoading ? "..." : (stats?.total ?? 0).toLocaleString()}
          icon={FlaskConical}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Examenes Activos"
          value={statsLoading ? "..." : (stats?.active ?? 0).toString()}
          icon={ToggleRight}
          className=" hidden md:block bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Perfiles"
          value={statsLoading ? "..." : (stats?.global ?? 0).toString()}
          icon={Package}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "exams"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("exams")}
        >
          <FlaskConical className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Exámenes
        </button>
        <button
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "profiles"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("profiles")}
        >
          <Package className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Perfiles
        </button>
        <button
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "order"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("order")}
        >
          <ListOrdered className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Orden de Impresión
        </button>
      </div>

      {activeTab === "exams" ? (
        <>

          <Card className="bg-card rounded-xl border border-border p-0 shadow-sm">
            <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-6 py-4 border-b border-border">
              <div className="flex flex-1 sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por nombre o categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>

            <Table className="w-full text-left border-collapse hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border" >
                  <TableHead>Examen</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tpl) => {
                  const isGlobal = tpl.org_id === null;
                  const canEdit = isSuperAdmin || (role === "lab_admin" && (isGlobal || tpl.org_id === orgId));
                  return (
                    <Fragment key={tpl.id}>
                      <TableRow className="cursor-pointer">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">{tpl.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryColors[tpl.category] ?? "bg-muted text-muted-foreground"}`}>
                            {tpl.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-success" />
                            <span className="text-sm font-semibold mono">{Number(tpl.base_price).toFixed(2)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            className="inline-flex items-center"
                            onClick={() => (isSuperAdmin || tpl.org_id === orgId) && toggleMutation.mutate({ id: tpl.id, is_active: !tpl.is_active })}
                            disabled={!isSuperAdmin && tpl.org_id !== orgId}
                          >
                            {tpl.is_active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleViewTemplatePreview(tpl)} disabled={previewLoading}>
                            <Eye className="w-3 h-3" /> Visualizar
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => handleEdit(tpl)}>
                              {isGlobal && !isSuperAdmin ? (<><Copy className="w-3 h-3" /> Editar</>) : (<><Pencil className="w-3 h-3" /> Editar</>)}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>

            {isLoading && (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground italic">Cargando Examenes...</p>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="py-20 text-center">
                <FlaskConical className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No se encontraron examenes con estos datos</p>
              </div>
            )}

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2 mb-4">
              {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Cargando examenes...</div>}
              {!isLoading && filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron examenes.</div>}
              {filtered.map((tpl) => {
                const isGlobal = tpl.org_id === null;
                const canEdit = isSuperAdmin || (role === "lab_admin" && (isGlobal || tpl.org_id === orgId));
                return (
                  <div key={tpl.id} className="bg-card rounded-xl border border-border p-4 m-2" style={{ boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="w-4 h-4 text-primary flex-shrink-0" />
                          <p className="text-sm font-semibold truncate">{tpl.name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${categoryColors[tpl.category] ?? "bg-muted text-muted-foreground"}`}>
                            {tpl.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <DollarSign className="w-3 h-3 text-success" />
                        <span className="text-sm font-bold mono">{Number(tpl.base_price).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={() => handleViewTemplatePreview(tpl)} disabled={previewLoading}>
                        <Eye className="w-3 h-3 mr-1" /> Visualizar
                      </Button>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={() => handleEdit(tpl)}>
                          {isGlobal && !isSuperAdmin ? (<><Copy className="w-3 h-3 mr-1" /> Editar</>) : (<><Pencil className="w-3 h-3 mr-1" /> Edit</>)}
                        </Button>
                      )}
                      <button
                        className="inline-flex items-center h-7 px-2"
                        onClick={() => (isSuperAdmin || tpl.org_id === orgId) && toggleMutation.mutate({ id: tpl.id, is_active: !tpl.is_active })}
                        disabled={!isSuperAdmin && tpl.org_id !== orgId}
                      >
                        {tpl.is_active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
              <span className="text-sm text-muted-foreground">
                Mostrando <span className="text-foreground">{Math.min(totalTemplates, (page - 1) * pageSize + 1)} a {Math.min(totalTemplates, page * pageSize)}</span> de <span className="text-foreground">{totalTemplates.toLocaleString()}</span> examenes
              </span>
              <div className="flex items-center gap-1.5 pb-4 sm:pb-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-md"
                  onClick={(e) => { e.stopPropagation(); setPage(prev => Math.max(prev - 1, 1)); }}
                  disabled={page <= 1}
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </Button>

                {[...Array(Math.min(5, pageCount))].map((_, i) => {
                  const p = i + 1;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      className={`h-8 w-8 rounded-md text-xs font-bold ${p === page ? "bg-primary text-primary-foreground" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setPage(p); }}
                    >
                      {p}
                    </Button>
                  );
                })}

                {pageCount > 5 && <span className="text-muted-foreground px-1">...</span>}
                {pageCount > 5 && (
                  <Button
                    variant={page === pageCount ? "default" : "outline"}
                    className="h-8 w-12 rounded-md text-xs font-bold"
                    onClick={(e) => { e.stopPropagation(); setPage(pageCount); }}
                  >
                    {pageCount}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-md"
                  onClick={(e) => { e.stopPropagation(); setPage(prev => Math.min(prev + 1, pageCount)); }}
                  disabled={page >= pageCount}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col w-[95vw]">
              <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Vista Previa: {previewTpl?.name}
                </DialogTitle>
              </DialogHeader>
              {previewTpl && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 w-full h-full">
                    <PDFViewer width="100%" height="100%" showToolbar={true} className="border-none">
                      <TestReportPDF
                        template={previewTpl}
                        labData={{
                          name: lab?.name || "Nombre del Laboratorio",
                          address: lab?.address || "Dirección desde Perfil",
                          phone: lab?.phone || "Teléfono desde Perfil",
                          email: lab?.email || "Correo desde Perfil",
                          logo: lab?.logo_url || null,
                          primary_color: lab?.primary_color || "#0ea5e9",
                          secondary_color: lab?.secondary_color || "#4f46e5",
                        }}
                      />
                    </PDFViewer>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : activeTab === "profiles" ? (
        /* ── PROFILES TAB ── */
        <>
          <Card className="bg-card rounded-xl border border-border p-0 shadow-sm">
            <CardHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Perfiles de Exámenes</h3>
                  <p className="text-xs text-muted-foreground">Paquetes de exámenes con precio promocional</p>
                </div>
              </div>
            </CardHeader>

            {profilesLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground italic">Cargando perfiles...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="py-20 text-center">
                <Package className="w-12 h-12 text-muted/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No has creado perfiles todavía</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setEditingProfile(null); setProfileDialogOpen(true); }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Crear primer perfil
                </Button>
              </div>
            ) : (
              <>
                <div className="block lg:hidden space-y-3 p-3">
                  {profiles.map((profile) => (
                    <article
                      key={profile.id}
                      className="cursor-pointer border border-border rounded-lg p-4 bg-background shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Package className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-sm block truncate">{profile.name}</span>
                            {profile.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          className="inline-flex items-center flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            profileToggleMutation.mutate({ id: profile.id, is_active: !profile.is_active });
                          }}
                        >
                          {profile.is_active
                            ? <ToggleRight className="w-5 h-5 text-success" />
                            : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3 gap-4">
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {profile.profile_templates_junction.length} exámenes
                        </Badge>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <DollarSign className="w-3.5 h-3.5 text-success" />
                          <span className="text-sm font-semibold mono">{Number(profile.total_price).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7 gap-1 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProfile(profile);
                          }}
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("¿Eliminar este perfil?")) {
                              profileDeleteMutation.mutate(profile.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <div className="min-w-[640px]">
                    <Table className="w-full text-left border-collapse">
                      <TableHeader>
                        <TableRow className="bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                          <TableHead className="px-6 py-4 font-semibold">Perfil</TableHead>
                          <TableHead className="px-6 py-4 font-semibold">Exámenes</TableHead>
                          <TableHead className="px-6 py-4 font-semibold">Precio</TableHead>
                          <TableHead className="px-6 py-4 font-semibold">Estado</TableHead>
                          <TableHead className="px-6 py-4 font-semibold text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow key={profile.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-primary" />
                                <div>
                                  <span className="font-medium text-sm">{profile.name}</span>
                                  {profile.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{profile.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <Badge variant="secondary" className="text-xs">
                                {profile.profile_templates_junction.length} exámenes
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-3.5 h-3.5 text-success" />
                                <span className="text-sm font-semibold mono">{Number(profile.total_price).toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <button
                                className="inline-flex items-center"
                                onClick={() => profileToggleMutation.mutate({ id: profile.id, is_active: !profile.is_active })}
                              >
                                {profile.is_active
                                  ? <ToggleRight className="w-5 h-5 text-success" />
                                  : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                                }
                              </button>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-xs h-7 gap-1"
                                  onClick={() => handleEditProfile(profile)}
                                >
                                  <Pencil className="w-3 h-3" /> Editar
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-xs h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm("¿Eliminar este perfil?")) {
                                      profileDeleteMutation.mutate(profile.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" /> Eliminar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </Card>

          <ProfileBuilderDialog
            open={profileDialogOpen}
            onOpenChange={(v) => { if (!v) { setProfileDialogOpen(false); setEditingProfile(null); } else setProfileDialogOpen(v); }}
            onSave={(data) => profileSaveMutation.mutate(data)}
            initialData={editingProfile ?? undefined}
            isSaving={profileSaveMutation.isPending}
            orgId={orgId!}
          />
        </>
      ) : (
        <ExamOrderView />
      )}
    </div>
  );
}

