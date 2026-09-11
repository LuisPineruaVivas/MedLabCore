import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { ChevronRight, Copy, DollarSign, Eye, FlaskConical, ListOrdered, Package, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/StatCard";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useUserRole } from "@/hooks/useUserRole";
import { ProfileBuilderDialog } from "@/features/tests/ProfileBuilderDialog";
import { ExamOrderView } from "@/features/tests/ExamOrderView";
import { DepartmentOrderView } from "@/features/tests/DepartmentOrderView";
import {
  useDeleteExamProfile,
  useExamProfiles,
  useSaveExamProfile,
  useTestTemplates,
  useTestTemplateStats,
  useToggleExamProfileActive,
  useToggleTestTemplateActive,
} from "@/features/tests/useTestTemplates";
import { getTestTemplateReportComponent } from "@/lib/orderReportDispatcher";
import { cn } from "@/lib/utils";
import { getUserFacingErrorMessage } from "@/lib/errors";
import type { TestTemplateRow } from "@/features/tests/schemas";
import type { ExamProfileRow } from "@/features/tests/profileSchemas";

type ExamProfileListItem = ExamProfileRow & { profile_templates_junction: { template_id: string }[] };

const categoryColors: Record<string, string> = {
  Hematologia: "bg-destructive/10 text-destructive",
  Uroanalisis: "bg-warning/10 text-warning",
  Bioquimica: "bg-info/10 text-info",
  Endocrinologia: "bg-success/10 text-success",
  Microbiologia: "bg-primary/10 text-primary",
  Immunologia: "bg-accent text-accent-foreground",
  Serologia: "bg-muted/10 text-muted",
  Coagulacion: "bg-destructive/10 text-destructive",
  "Pruebas Especiales": "bg-warning/10 text-warning",
};

function isMobileDevice() {
  return typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
}

function getLabData(organization: ReturnType<typeof useCurrentOrgContext>["organization"]) {
  return {
    name: organization?.name || "Nombre del Laboratorio",
    address: organization?.address || "Dirección desde Perfil",
    phone: organization?.phone || "Teléfono desde Perfil",
    email: organization?.email || "Correo desde Perfil",
    logo: organization?.logo_url || null,
    primary_color: organization?.primary_color || "#0ea5e9",
    secondary_color: organization?.secondary_color || "#4f46e5",
  };
}

export default function TestsPage() {
  const { orgId, organization } = useCurrentOrgContext();
  const { role, isSuperAdmin } = useUserRole();
  const PreviewReport = getTestTemplateReportComponent(organization?.report_template);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"exams" | "profiles" | "order" | "departments">("exams");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewTpl, setPreviewTpl] = useState<TestTemplateRow | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<{ id: string; name: string; description: string | null; total_price: number; template_ids: string[] } | null>(null);
  const debouncedSearch = useDebounce(search, 500);
  const pageSize = 10;

  const { data: templatesData, isLoading } = useTestTemplates(page, debouncedSearch);
  const { data: profiles = [], isLoading: profilesLoading } = useExamProfiles(activeTab === "profiles");
  const { data: stats, isLoading: statsLoading } = useTestTemplateStats();
  const profileSaveMutation = useSaveExamProfile();
  const toggleMutation = useToggleTestTemplateActive();
  const profileDeleteMutation = useDeleteExamProfile();
  const profileToggleMutation = useToggleExamProfileActive();
  const templates = templatesData?.items ?? [];
  const totalTemplates = templatesData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalTemplates / pageSize));
  const canManageTests = isSuperAdmin || role === "lab_admin";

  useEffect(() => setPage(1), [debouncedSearch]);

  async function handleViewTemplatePreview(template: TestTemplateRow) {
    if (isMobileDevice()) {
      setPreviewLoading(true);
      try {
        const blob = await pdf(<PreviewReport template={template} labData={getLabData(organization)} />).toBlob();
        if (!blob) {
          toast.error("No se pudo generar el PDF");
          return;
        }
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        toast.error("Error al generar el PDF");
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    setPreviewTpl(template);
    setIsPreviewOpen(true);
  }

  function handleEdit(tpl: TestTemplateRow) {
    const isGlobal = tpl.org_id === null;
    navigate(!isSuperAdmin && isGlobal ? `/tests/templates/${tpl.id}/edit?fork=1` : `/tests/templates/${tpl.id}/edit`);
  }

  function handleEditProfile(profile: ExamProfileListItem) {
    setEditingProfile({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      total_price: Number(profile.total_price),
      template_ids: profile.profile_templates_junction.map((junction) => junction.template_id),
    });
    setProfileDialogOpen(true);
  }

  return (
    <div className="space-y-4 animate-fade-in sm:space-y-6">
      <PageHeader
        title="Examenes de laboratorio"
        description="Define y personaliza los examenes disponibles en tu laboratorio"
        actions={canManageTests && (
          <div className="flex items-center gap-2">
            {activeTab === "profiles" ? (
              <Button size="sm" onClick={() => { setEditingProfile(null); setProfileDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4 sm:mr-2" />
                Nuevo Perfil
              </Button>
            ) : activeTab === "exams" ? (
              <Button size="sm" onClick={() => navigate("/tests/templates/new")}>
                <Plus className="mr-1 h-4 w-4 sm:mr-2" />
                Nuevo Examen
              </Button>
            ) : null}
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-6 pt-4 md:grid-cols-3">
        <StatCard title="Total Examenes" value={statsLoading ? "..." : (stats?.total ?? 0).toLocaleString()} icon={FlaskConical} className="border-border bg-white shadow-sm transition-shadow hover:shadow-md" />
        <StatCard title="Examenes Activos" value={statsLoading ? "..." : String(stats?.active ?? 0)} icon={ToggleRight} className="hidden border-border bg-white shadow-sm transition-shadow hover:shadow-md md:block" />
        <StatCard title="Perfiles" value={statsLoading ? "..." : String(stats?.profiles ?? 0)} icon={Package} className="border-border bg-white shadow-sm transition-shadow hover:shadow-md" />
      </div>

      <div className="w-fit items-center gap-1 rounded-lg bg-muted/50 p-1 md:inline-flex">
        <button className={cn("rounded-md px-4 py-2 text-sm font-medium transition-all", activeTab === "exams" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setActiveTab("exams")}><FlaskConical className="mr-1.5 inline-block h-4 w-4" />Examenes</button>
        <button className={cn("rounded-md px-4 py-2 text-sm font-medium transition-all", activeTab === "profiles" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setActiveTab("profiles")}><Package className="mr-1.5 inline-block h-4 w-4" />Perfiles</button>
        <button className={cn("rounded-md px-4 py-2 text-sm font-medium transition-all", activeTab === "order" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setActiveTab("order")}><ListOrdered className="mr-1.5 inline-block h-4 w-4" />Orden de Impresion</button>
        <button className={cn("rounded-md px-4 py-2 text-sm font-medium transition-all", activeTab === "departments" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setActiveTab("departments")}><ListOrdered className="mr-1.5 inline-block h-4 w-4" />Orden de Departamentos</button>
      </div>

      {activeTab === "exams" ? (
        <>
          <Card className="rounded-xl border border-border bg-card p-0 shadow-sm">
            <CardHeader className="flex flex-col gap-4 border-b border-border px-6 py-4 lg:flex-row lg:items-center">
              <div className="flex flex-1 gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por nombre o categoria" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
              </div>
            </CardHeader>

            <Table className="hidden w-full border-collapse text-left md:table">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <TableHead>Examen</TableHead><TableHead>Departamento</TableHead><TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => {
                  const isGlobal = tpl.org_id === null;
                  const canEdit = isSuperAdmin || (role === "lab_admin" && (isGlobal || tpl.org_id === orgId));
                  return (
                    <Fragment key={tpl.id}>
                      <TableRow className="cursor-pointer">
                        <TableCell><div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{tpl.name}</span></div></TableCell>
                        <TableCell><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColors[tpl.category] ?? "bg-muted text-muted-foreground"}`}>{tpl.category}</span></TableCell>
                        <TableCell className="text-right"><div className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-success" /><span className="mono text-sm font-semibold">{Number(tpl.base_price).toFixed(2)}</span></div></TableCell>
                        <TableCell>
                          <button className="inline-flex items-center" onClick={() => (isSuperAdmin || tpl.org_id === orgId) && toggleMutation.mutate({ id: tpl.id, is_active: !tpl.is_active })} disabled={!isSuperAdmin && tpl.org_id !== orgId}>
                            {tpl.is_active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleViewTemplatePreview(tpl)} disabled={previewLoading}><Eye className="h-3 w-3" />Visualizar</Button>
                          {canEdit && <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEdit(tpl)}>{isGlobal && !isSuperAdmin ? <Copy className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}Editar</Button>}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {isLoading && <div className="space-y-3 py-20 text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p className="text-sm italic text-muted-foreground">Cargando examenes...</p></div>}
            {!isLoading && templates.length === 0 && <div className="py-20 text-center"><FlaskConical className="mx-auto mb-3 h-12 w-12 text-muted" /><p className="text-sm text-muted-foreground">No se encontraron examenes con estos datos</p></div>}

            <div className="mb-4 space-y-2 md:hidden">
              {templates.map((tpl) => {
                const isGlobal = tpl.org_id === null;
                const canEdit = isSuperAdmin || (role === "lab_admin" && (isGlobal || tpl.org_id === orgId));
                return (
                  <div key={tpl.id} className="m-2 rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 flex-shrink-0 text-primary" /><p className="truncate text-sm font-semibold">{tpl.name}</p></div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${categoryColors[tpl.category] ?? "bg-muted text-muted-foreground"}`}>{tpl.category}</span></div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1"><DollarSign className="h-3 w-3 text-success" /><span className="mono text-sm font-bold">{Number(tpl.base_price).toFixed(2)}</span></div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => handleViewTemplatePreview(tpl)} disabled={previewLoading}><Eye className="mr-1 h-3 w-3" />Visualizar</Button>
                      {canEdit && <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => handleEdit(tpl)}>{isGlobal && !isSuperAdmin ? <Copy className="mr-1 h-3 w-3" /> : <Pencil className="mr-1 h-3 w-3" />}Editar</Button>}
                      <button className="inline-flex h-7 items-center px-2" onClick={() => (isSuperAdmin || tpl.org_id === orgId) && toggleMutation.mutate({ id: tpl.id, is_active: !tpl.is_active })} disabled={!isSuperAdmin && tpl.org_id !== orgId}>{tpl.is_active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
              <span className="text-sm text-muted-foreground">Mostrando <span className="text-foreground">{Math.min(totalTemplates, (page - 1) * pageSize + 1)} a {Math.min(totalTemplates, page * pageSize)}</span> de <span className="text-foreground">{totalTemplates.toLocaleString()}</span> examenes</span>
              <div className="flex items-center gap-1.5 pb-4 sm:pb-0">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={(event) => { event.stopPropagation(); setPage((previous) => Math.max(previous - 1, 1)); }} disabled={page <= 1}><ChevronRight className="h-4 w-4 rotate-180" /></Button>
                {[...Array(Math.min(5, pageCount))].map((_, index) => {
                  const nextPage = index + 1;
                  return <Button key={nextPage} variant={nextPage === page ? "default" : "outline"} className={`h-8 w-8 rounded-md text-xs font-bold ${nextPage === page ? "bg-primary text-primary-foreground" : ""}`} onClick={(event) => { event.stopPropagation(); setPage(nextPage); }}>{nextPage}</Button>;
                })}
                {pageCount > 5 && <span className="px-1 text-muted-foreground">...</span>}
                {pageCount > 5 && <Button variant={page === pageCount ? "default" : "outline"} className="h-8 w-12 rounded-md text-xs font-bold" onClick={(event) => { event.stopPropagation(); setPage(pageCount); }}>{pageCount}</Button>}
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={(event) => { event.stopPropagation(); setPage((previous) => Math.min(previous + 1, pageCount)); }} disabled={page >= pageCount}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardFooter>
          </Card>

          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden p-0">
              <DialogHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6"><DialogTitle className="flex items-center gap-2 text-sm sm:text-base"><FlaskConical className="h-4 w-4 text-primary sm:h-5 sm:w-5" />Vista Previa: {previewTpl?.name}</DialogTitle></DialogHeader>
              {previewTpl && <div className="flex h-full flex-col"><div className="h-full w-full flex-1"><PDFViewer width="100%" height="100%" showToolbar className="border-none"><PreviewReport template={previewTpl} labData={getLabData(organization)} /></PDFViewer></div></div>}
            </DialogContent>
          </Dialog>
        </>
      ) : activeTab === "profiles" ? (
        <>
          <Card className="rounded-xl border border-border bg-card p-0 shadow-sm">
            <CardHeader className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3"><Package className="h-5 w-5 text-primary" /><div><h3 className="text-sm font-semibold">Perfiles de Examenes</h3><p className="text-xs text-muted-foreground">Paquetes de examenes con precio establecido</p></div></div>
            </CardHeader>

            {profilesLoading ? (
              <div className="space-y-3 py-20 text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p className="text-sm italic text-muted-foreground">Cargando perfiles...</p></div>
            ) : profiles.length === 0 ? (
              <div className="py-20 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-muted/30" /><p className="text-sm text-muted-foreground">No has creado perfiles todavia</p><Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditingProfile(null); setProfileDialogOpen(true); }}><Plus className="mr-1 h-4 w-4" />Crear primer perfil</Button></div>
            ) : (
              <>
                <div className="block space-y-3 p-3 lg:hidden">
                  {profiles.map((profile) => (
                    <article key={profile.id} className="cursor-pointer rounded-lg border border-border bg-background p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Package className="h-4 w-4 flex-shrink-0 text-primary" /><div className="min-w-0"><span className="block truncate text-sm font-medium">{profile.name}</span>{profile.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{profile.description}</p>}</div></div></div>
                        <button className="inline-flex flex-shrink-0 items-center" onClick={(event) => { event.stopPropagation(); profileToggleMutation.mutate({ id: profile.id, is_active: !profile.is_active }); }}>{profile.is_active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}</button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4"><Badge variant="secondary" className="text-xs">{profile.profile_templates_junction.length} examenes</Badge><div className="flex flex-shrink-0 items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-success" /><span className="mono text-sm font-semibold">{Number(profile.total_price).toFixed(2)}</span></div></div>
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                        <Button variant="ghost" size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={() => handleEditProfile(profile)}><Pencil className="h-3 w-3" />Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 flex-1 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("¿Eliminar este perfil?")) profileDeleteMutation.mutate(profile.id); }}><Trash2 className="h-3 w-3" />Eliminar</Button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <div className="min-w-[640px]">
                    <Table className="w-full border-collapse text-left">
                      <TableHeader><TableRow className="border-b border-border bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><TableHead className="px-6 py-4 font-semibold">Perfil</TableHead><TableHead className="px-6 py-4 font-semibold">Examenes</TableHead><TableHead className="px-6 py-4 font-semibold">Precio</TableHead><TableHead className="px-6 py-4 font-semibold">Estado</TableHead><TableHead className="px-6 py-4 text-right font-semibold">Acciones</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow key={profile.id} className="transition-colors hover:bg-muted/20">
                            <TableCell className="px-6 py-4"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><div><span className="text-sm font-medium">{profile.name}</span>{profile.description && <p className="mt-0.5 text-xs text-muted-foreground">{profile.description}</p>}</div></div></TableCell>
                            <TableCell className="px-6 py-4"><Badge variant="secondary" className="text-xs">{profile.profile_templates_junction.length} examenes</Badge></TableCell>
                            <TableCell className="px-6 py-4"><div className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-success" /><span className="mono text-sm font-semibold">{Number(profile.total_price).toFixed(2)}</span></div></TableCell>
                            <TableCell className="px-6 py-4"><button className="inline-flex items-center" onClick={() => profileToggleMutation.mutate({ id: profile.id, is_active: !profile.is_active })}>{profile.is_active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}</button></TableCell>
                            <TableCell className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEditProfile(profile)}><Pencil className="h-3 w-3" />Editar</Button><Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm("¿Eliminar este perfil?")) profileDeleteMutation.mutate(profile.id); }}><Trash2 className="h-3 w-3" />Eliminar</Button></div></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </Card>

          {orgId && <ProfileBuilderDialog open={profileDialogOpen} onOpenChange={(open) => { setProfileDialogOpen(open); if (!open) setEditingProfile(null); }} onSave={(data) => { profileSaveMutation.mutate(data, { onSuccess: () => { toast.success("Perfil guardado correctamente"); setProfileDialogOpen(false); setEditingProfile(null); }, onError: (error) => toast.error(getUserFacingErrorMessage(error, "No se pudo guardar el perfil")) }); }} initialData={editingProfile ?? undefined} isSaving={profileSaveMutation.isPending} orgId={orgId} />}
        </>
      ) : activeTab === "order" ? (
        <ExamOrderView />
      ) : (
        <DepartmentOrderView />
      )}
    </div>
  );
}
