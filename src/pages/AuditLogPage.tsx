import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Calendar as CalendarIcon,
  Filter,
  Eye,
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
  ClipboardList,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useAuditLogs,
  useOrgUsersForFilter,
  type AuditLogRow,
} from "@/features/audit/useAuditLogs";

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [userId, setUserId] = useState<string>("all");
  const [actionCategory, setActionCategory] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const { data: users = [] } = useOrgUsersForFilter();
  const { data, isLoading, refetch, isFetching } = useAuditLogs({
    page,
    pageSize: 15,
    userId,
    actionCategory,
    dateFrom,
    dateTo,
    search: debouncedSearch,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleClearFilters = () => {
    setSearch("");
    setUserId("all");
    setActionCategory("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    search !== "" ||
    userId !== "all" ||
    actionCategory !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  // Helper para renderizar badges según la acción
  const getActionBadge = (action: string) => {
    switch (action) {
      case "ORDER_CREATED":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Orden Creada
          </Badge>
        );
      case "ORDER_APPROVED":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Informe Aprobado
          </Badge>
        );
      case "ORDER_CANCELLED":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" /> Orden Cancelada
          </Badge>
        );
      case "ORDER_STATUS_CHANGED":
        return (
          <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1 font-medium">
            <RefreshCw className="w-3 h-3" /> Cambio de Estado
          </Badge>
        );
      case "ORDER_PAYMENT_CHANGED":
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" /> Estado de Pago
          </Badge>
        );
      case "PATIENT_CREATED":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1 font-medium">
            <User className="w-3 h-3" /> Paciente Creado
          </Badge>
        );
      case "PATIENT_UPDATED":
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1 font-medium">
            <User className="w-3 h-3" /> Paciente Editado
          </Badge>
        );
      case "SUPERADMIN_IMPERSONATION_START":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3 h-3 text-amber-600" /> Suplantación (Inicio)
          </Badge>
        );
      case "SUPERADMIN_IMPERSONATION_END":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Suplantación (Fin)
          </Badge>
        );
      case "ROLE_CHANGED":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3 h-3" /> Cambio de Rol
          </Badge>
        );
      case "USER_ORG_TRANSFERRED":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3 h-3" /> Traslado Usuario
          </Badge>
        );
      case "TEST_TEMPLATE_CREATED":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 font-medium">
            <FileSpreadsheet className="w-3 h-3" /> Examen Creado
          </Badge>
        );
      case "TEST_TEMPLATE_UPDATED":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 font-medium">
            <FileSpreadsheet className="w-3 h-3" /> Examen Editado
          </Badge>
        );
      case "EXCHANGE_RATE_UPDATED":
        return (
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" /> Tasa Cambiaria
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-xs">
            {action}
          </Badge>
        );
    }
  };

  // Helper para traducir tipo de entidad
  const getEntityLabel = (entityType: string, log: AuditLogRow) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    switch (entityType) {
      case "orders":
        return meta.order_seq ? `Orden #${meta.order_seq}` : "Orden";
      case "patients":
        return (meta.full_name as string) || (meta.id_number as string) || "Paciente";
      case "profiles":
        return (meta.target_user_name as string) || (meta.target_user_email as string) || "Usuario";
      case "test_templates":
        return (meta.test_name as string) || "Plantilla Examen";
      case "exchange_rates":
        return "Tasa BCV";
      default:
        return entityType;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader
        title="Bitácora de Actividades"
        description="Historial inmutable y detallado de las operaciones críticas realizadas en el sistema"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        }
      />

      {/* Contenedor de Filtros */}
      <Card className="border border-border/80 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
              <Filter className="w-4 h-4 text-primary" />
              <span>Filtros de Búsqueda</span>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
            {/* Buscador de texto */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  placeholder="Usuario o acción..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Filtro de Usuario */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Usuario</label>
              <Select
                value={userId}
                onValueChange={(val) => {
                  setUserId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email || "Usuario sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Categoría / Tipo de Acción */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de Acción</label>
              <Select
                value={actionCategory}
                onValueChange={(val) => {
                  setActionCategory(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="orders">Órdenes médicas</SelectItem>
                  <SelectItem value="patients">Pacientes</SelectItem>
                  <SelectItem value="templates">Plantillas de exámenes</SelectItem>
                  <SelectItem value="security">Seguridad y Roles</SelectItem>
                  <SelectItem value="financial">Finanzas y Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rango Desde */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha Desde</label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Rango Hasta */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha Hasta</label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Logs */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[180px] text-xs font-semibold">Fecha y Hora</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold">Usuario</TableHead>
              <TableHead className="w-[190px] text-xs font-semibold">Acción</TableHead>
              <TableHead className="text-xs font-semibold">Elemento Afectado</TableHead>
              <TableHead className="w-[100px] text-right text-xs font-semibold">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-xs font-medium">Cargando registros de auditoría...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ClipboardList className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No se encontraron actividades registradas</p>
                    <p className="text-xs text-muted-foreground/80">
                      {hasActiveFilters
                        ? "Intenta modificar o limpiar los filtros seleccionados."
                        : "Los eventos críticos se registrarán aquí automáticamente."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const date = new Date(log.created_at);
                const formattedDate = format(date, "dd MMM yyyy, HH:mm:ss", { locale: es });

                if (log.action === "SUPERADMIN_IMPERSONATION_START" || log.action === "SUPERADMIN_IMPERSONATION_END") {
                  // Omitir la visualización de los eventos de suplantación de superadmin
                  return null;
                }

                return (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span>{formattedDate}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {log.user_name ? log.user_name.charAt(0).toUpperCase() : "S"}
                        </div>
                        <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
                          {log.user_name || "Sistema"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>{getActionBadge(log.action)}</TableCell>

                    <TableCell>
                      <div className="text-xs text-foreground font-medium flex items-center gap-1.5">
                        <span className="text-muted-foreground capitalize text-[11px] px-1.5 py-0.5 rounded bg-muted">
                          {log.entity_type}
                        </span>
                        <span className="truncate">{getEntityLabel(log.entity_type, log)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 w-7 p-0 rounded-full hover:bg-muted"
                        title="Ver detalles del evento"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Paginación */}
        {total > 0 && (
          <div className="p-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Mostrando <span className="font-semibold text-foreground">{logs.length}</span> de{" "}
              <span className="font-semibold text-foreground">{total}</span> actividades
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
              </Button>

              <span className="text-xs font-medium px-1">
                Página {page} de {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="h-8 px-2.5 text-xs"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalle JSON / Metadata */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-5 h-5 text-primary" />
              Detalles del Registro de Auditoría
            </DialogTitle>
            <DialogDescription className="text-xs">
              Información contextual y cambios registrados al momento de la acción
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Resumen principal */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border/70">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Acción</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Fecha y Hora</span>
                  <span className="font-medium text-foreground mt-0.5 block">
                    {format(new Date(selectedLog.created_at), "dd MMMM yyyy, HH:mm:ss", { locale: es })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Responsable</span>
                  <span className="font-medium text-foreground mt-0.5 block">
                    {selectedLog.user_name || "Sistema"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Entidad</span>
                  <span className="font-medium text-foreground mt-0.5 block capitalize">
                    {selectedLog.entity_type} {selectedLog.entity_id ? `(${selectedLog.entity_id.slice(0, 8)}...)` : ""}
                  </span>
                </div>
              </div>

              {/* Visualización de Cambios Específicos si existen */}
              {selectedLog.metadata &&
                typeof selectedLog.metadata === "object" &&
                "changes" in selectedLog.metadata &&
                selectedLog.metadata.changes && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground text-xs block">
                      Campos Modificados:
                    </span>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th className="p-2 font-medium">Campo</th>
                            <th className="p-2 font-medium">Valor Anterior</th>
                            <th className="p-2 font-medium">Nuevo Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(
                            selectedLog.metadata.changes as Record<string, { old: unknown; new: unknown }>
                          ).map(([field, diff]) => (
                            <tr key={field} className="hover:bg-muted/20">
                              <td className="p-2 font-mono font-medium text-primary">{field}</td>
                              <td className="p-2 text-rose-600 bg-rose-50/50 line-through">
                                {String(diff?.old ?? "—")}
                              </td>
                              <td className="p-2 text-emerald-700 bg-emerald-50/50 font-medium">
                                {String(diff?.new ?? "—")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* JSON Crudo de Metadata */}
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground text-xs block">
                  Metadatos / Carga de Datos Completa (JSON):
                </span>
                <div className="bg-slate-950 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-64 font-mono text-[11px] leading-relaxed border border-slate-800">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
