import {
  Users,
  FlaskConical,
  ClipboardList,
  DollarSign,
  Activity,
  RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErpDashboardWidgets } from "@/features/erp/components/ErpDashboardWidgets";
import {
  useDashboardStats,
  usePendingOrders,
  useTopTests,
} from "@/features/dashboard/useDashboardData";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentOrders, isLoading: ordersLoading } = usePendingOrders();
  const { data: topTests, isLoading: testsLoading } = useTopTests();
  const { orgId } = useCurrentOrgContext();
  const { data: exchangeRate } = useExchangeRate(orgId);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Panel de control"
        description="Resumen de actividad laboratorio"
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))
        ) : (
          <>
            <StatCard
              title="Pacientes Registrados"
              value={stats?.totalPatients.toLocaleString() ?? "0"}
              icon={Users}
            />
            <StatCard
              title="Pruebas realizadas hoy"
              value={stats?.ordersToday ?? 0}
              icon={FlaskConical}
            />
            <StatCard
              title="Pruebas pendientes"
              value={stats?.pendingOrders ?? 0}
              icon={ClipboardList}
            />
            <StatCard
              title="Ingresos (Hoy)"
              value={`$${(stats?.todayRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      <ErpDashboardWidgets orgId={orgId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Orders */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Pruebas pendientes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Pruebas de laboratorio pendientes</p>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {ordersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))
            ) : !recentOrders?.length ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No hay pruebas recientes
              </div>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      navigate(`/orders/${order.id}`);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.patient}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {order.tests.join(", ") || "—"}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-semibold mono tabular-nums w-16 text-right">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="font-semibold text-sm mb-4">Pruebas más realizadas</h3>
            <div className="space-y-3">
              {testsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6" />
                ))
              ) : !topTests?.length ? (
                <p className="text-xs text-muted-foreground">No hay pruebas</p>
              ) : (
                topTests.map((test) => (
                  <div key={test.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{test.name}</span>
                      <span className="text-xs text-muted-foreground mono">{test.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${test.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Exchange Rate Widget */}
          <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Tasa de Cambio</h3>
            </div>
            {exchangeRate ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {Number(exchangeRate.rate).toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">BS/USD</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Actualizada {format(new Date(exchangeRate.updated_at), "dd MMM yyyy, hh:mm a", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fuente: {exchangeRate.source === "api" ? "automatica" : "respaldo local"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin tasa disponible</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
