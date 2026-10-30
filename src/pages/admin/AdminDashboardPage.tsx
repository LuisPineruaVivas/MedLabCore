import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuperAdminMetrics } from "@/features/subscription/useAdminSubscriptions";
import {
  Building2,
  Users,
  ShoppingCart,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function AdminDashboardPage() {
  const { data: metrics, isLoading, refetch, isRefetching } = useSuperAdminMetrics();
  const [searchTerm, setSearchTerm] = useState("");

  const summary = metrics?.summary;
  const organizations = metrics?.organizations ?? [];

  const filteredOrgs = organizations.filter((org) => {
    const term = searchTerm.toLowerCase();
    return (
      org.name.toLowerCase().includes(term) ||
      (org.rif && org.rif.toLowerCase().includes(term)) ||
      (org.city && org.city.toLowerCase().includes(term)) ||
      (org.admin_email && org.admin_email.toLowerCase().includes(term))
    );
  });

  // Data for chart (top 7 labs by orders)
  const chartData = [...organizations]
    .sort((a, b) => b.total_orders - a.total_orders)
    .slice(0, 8)
    .map((org) => ({
      name: org.name.length > 14 ? `${org.name.substring(0, 12)}...` : org.name,
      ordenes: org.total_orders,
      pacientes: org.total_patients,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Panel de Control Super Admin"
        description="Monitoreo global de métricas del sistema SaaS, volumen de órdenes, pacientes y licencias de laboratorios."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button asChild size="sm" className="text-xs">
              <Link to="/admin/subscriptions">
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Validar Pagos
                {summary?.pending_payments ? (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white text-primary font-bold text-[10px]">
                    {summary.pending_payments}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Laboratorios */}
        <div
          className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Laboratorios</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {isLoading ? "..." : summary?.total_organizations ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {summary?.active_subscriptions ?? 0} activos
              </span>
              <span>•</span>
              <span className="text-destructive font-medium">{summary?.expired_subscriptions ?? 0} vencidos</span>
            </div>
          </div>
        </div>

        {/* Pagos Pendientes */}
        <div
          className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between relative overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {summary?.pending_payments ? (
            <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          ) : null}
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Pagos por Validar</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {isLoading ? "..." : summary?.pending_payments ?? 0}
            </div>
            <div className="mt-1">
              <Link
                to="/admin/subscriptions"
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                Revisar en bandeja <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Órdenes Totales */}
        <div
          className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Órdenes Realizadas</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {isLoading ? "..." : summary?.total_orders ?? 0}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{summary?.orders_month ?? 0}</span> este mes
              <span>•</span>
              <span className="font-semibold text-foreground">{summary?.orders_today ?? 0}</span> hoy
            </div>
          </div>
        </div>

        {/* Pacientes Registrados */}
        <div
          className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Pacientes Globales</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {isLoading ? "..." : summary?.total_patients ?? 0}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">En toda la red de laboratorios</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div
          className="rounded-xl border border-border bg-card p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Actividad por Laboratorio (Top Laboratorios)</h3>
            <p className="text-xs text-muted-foreground">Comparativa de volumen de órdenes vs pacientes atendidos</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="ordenes" name="Órdenes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pacientes" name="Pacientes" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla Detallada de Laboratorios */}
      <div
        className="rounded-xl border border-border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Métricas por Laboratorio Clínico</h3>
            <p className="text-xs text-muted-foreground">
              Supervisión de pacientes, órdenes del mes y vigencia de suscripción por sede.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nombre, ciudad o admin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Laboratorio</TableHead>
              <TableHead className="text-xs font-semibold">Admin</TableHead>
              <TableHead className="text-xs font-semibold text-center">Pacientes</TableHead>
              <TableHead className="text-xs font-semibold text-center">Órdenes (Mes / Total)</TableHead>
              <TableHead className="text-xs font-semibold">Vencimiento Suscripción</TableHead>
              <TableHead className="text-xs font-semibold">Estado</TableHead>
              <TableHead className="text-right text-xs font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  Cargando métricas de laboratorios...
                </TableCell>
              </TableRow>
            ) : filteredOrgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  No se encontraron laboratorios con ese criterio.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrgs.map((org) => {
                const now = new Date();
                const expiresAt = org.subscription_expires_at ? new Date(org.subscription_expires_at) : null;
                const graceUntil = org.subscription_grace_until ? new Date(org.subscription_grace_until) : null;
                const isGrace = Boolean(graceUntil && graceUntil.getTime() > now.getTime());
                const isExpired = Boolean(!expiresAt || expiresAt.getTime() <= now.getTime());
                const diffDays = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                return (
                  <TableRow key={org.id} className="text-xs">
                    <TableCell>
                      <div className="font-semibold text-foreground">{org.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {org.rif ? `RIF: ${org.rif}` : ""} {org.city ? `• ${org.city}` : ""}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-foreground">{org.admin_name || "Sin nombre"}</div>
                      <div className="text-[11px] text-muted-foreground">{org.admin_email || "Sin email"}</div>
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-bold text-foreground">{org.total_patients}</span>
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-semibold text-primary">{org.orders_this_month}</span>
                      <span className="text-muted-foreground"> / {org.total_orders}</span>
                    </TableCell>

                    <TableCell>
                      {expiresAt ? (
                        <div>
                          <span className="font-medium">
                            {format(expiresAt, "dd/MM/yyyy", { locale: es })}
                          </span>
                          {!isExpired && diffDays <= 3 && (
                            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                              Vence en {diffDays === 0 ? "horas" : `${diffDays}d`}
                            </span>
                          )}
                          {isGrace && (
                            <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                              En gracia hasta {format(graceUntil!, "dd/MM HH:mm")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin fecha</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {isExpired && !isGrace ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Vencida
                        </Badge>
                      ) : isGrace ? (
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px]">
                          En Gracia
                        </Badge>
                      ) : diffDays <= 3 ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px]">
                          Por Vencer
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                          Activa
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link to="/admin/organizations">Ver Lab</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
