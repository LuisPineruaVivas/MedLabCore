import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DollarSign, TrendingUp, Receipt, CreditCard, Search } from "lucide-react";
import { useEffect, useState } from "react";


export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const pageSize = 10;
  const debouncedSearch = useDebounce(search, 500);

  const { user } = useAuth();
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

  const { data: billingData, isLoading } = useQuery({
    queryKey: ["billing-orders", orgId, debouncedSearch, statusFilter, monthFilter, page],
    queryFn: async () => {
      if (!orgId) return { orders: [], total: 0, totalRevenue: 0, monthRevenue: 0, pendingCount: 0 };

      const offset = (page - 1) * pageSize;
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      // Calculate month filter dates
      let monthFilterStart: string | null = null;
      let monthFilterEnd: string | null = null;
      if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        monthFilterStart = new Date(year, month - 1, 1).toISOString();
        monthFilterEnd = new Date(year, month, 1).toISOString();
      }

      let query = supabase
        .from("orders")
        .select(
          "id, status, total_amount, created_at, order_seq, patients(first_name,last_name,id_number), order_items(id)",
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "pendiente" | "procesando" | "completada" | "cancelada");
      }

      if (monthFilterStart && monthFilterEnd) {
        query = query.gte("created_at", monthFilterStart).lt("created_at", monthFilterEnd);
      }

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`id.ilike.${term},patients.first_name.ilike.${term},patients.last_name.ilike.${term},patients.id_number.ilike.${term}`);
      }

      const [{ data: ordersPage, error: pageError, count }, { data: allOrders, error: allError }] = await Promise.all([
        query.range(offset, offset + pageSize - 1),
        supabase.from("orders").select("total_amount,status,created_at").eq("org_id", orgId),
      ]);

      if (pageError) throw pageError;
      if (allError) throw allError;

      const allOrderList = allOrders ?? [];

      // Filter orders for statistics based on month filter
      let filteredOrders = allOrderList;
      if (monthFilterStart && monthFilterEnd) {
        filteredOrders = allOrderList.filter(order =>
          order.created_at >= monthFilterStart! && order.created_at < monthFilterEnd!
        );
      }

      const totalRevenue = filteredOrders.reduce((acc, order) => acc + Number(order.total_amount ?? 0), 0);
      const thisMonthRevenue = allOrderList
        .filter((order) => order.created_at >= monthStart)
        .reduce((acc, order) => acc + Number(order.total_amount ?? 0), 0);
      const pendingCount = filteredOrders.filter((order) => order.status === "pendiente").length;

      return {
        orders: (ordersPage ?? []).map((order) => ({
          ...order,
          patientName: `${order.patients?.first_name ?? ""} ${order.patients?.last_name ?? ""}`.trim(),
          patientId: order.patients?.id_number,
          tests: (order.order_items ?? []).length,
          created: format(new Date(order.created_at), "yyyy-MM-dd"),
        })),
        total: count ?? 0,
        totalRevenue,
        thisMonthRevenue,
        pendingCount,
      };
    },
    enabled: !!orgId,
  });

  const orders = billingData?.orders ?? [];
  const totalOrders = billingData?.total ?? 0;
  const totalRevenue = billingData?.totalRevenue ?? 0;
  const thisMonthRevenue = billingData?.thisMonthRevenue ?? 0;
  const pendingCount = billingData?.pendingCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalOrders / pageSize));

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, monthFilter]);


  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Facturación" // (Ordenes)
        description="Monitorea ingresos y controla el estado de las órdenes de examen"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Recaudado" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} trend={{ value: Number(((totalRevenue - thisMonthRevenue) / Math.max(thisMonthRevenue, 1) * 100).toFixed(0)), label: "vs mes" }} />
        <StatCard title="Mes Actual" value={`$${thisMonthRevenue.toFixed(2)}`} icon={TrendingUp} trend={{ value: 0, label: "" }} />
        <StatCard title="Ordenes Totales" value={totalOrders.toLocaleString()} icon={Receipt} subtitle="Ordenes registradas" />
        <StatCard title="Pendientes" value={pendingCount.toLocaleString()} icon={CreditCard} subtitle="Estado pendiente" />
      </div>

      <Card className="bg-card rounded-xl border border-border p-0 shadow-sm">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-6 py-4 border-b border-border">
          <div className="flex flex-1 sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por id, nombre o cedula" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-md px-3 py-2 bg-background"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="procesando">Procesando</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-border rounded-md px-3 py-2 bg-background"
              placeholder="Filtrar por mes"
            />
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Orden</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Paciente</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pruebas</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Total</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Fecha</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Cargando...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No se encontraron órdenes.</td></tr>
              ) : orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => window.location.href = `/orders/${ord.id}`}>
                  <td className="px-5 py-3.5"><span className="text-sm font-medium mono">#{ord.order_seq.toString().padStart(4, '0')}</span></td>
                  <td className="px-5 py-3.5"><span className="text-sm">{ord.patientName || "-"}</span></td>
                  <td className="px-5 py-3.5"><span className="text-sm text-muted-foreground">{ord.tests}</span></td>
                  <td className="px-5 py-3.5"><span className="text-sm font-semibold mono">${Number(ord.total_amount).toFixed(2)}</span></td>
                  <td className="px-5 py-3.5"><span className="text-sm text-muted-foreground">{ord.created}</span></td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    ord.status === "completada" ? "bg-success/10 text-success border-success/20" : ord.status === "pendiente" ? "bg-warning/10 text-warning border-warning/20" : "bg-muted/10 text-muted-foreground border-border"
                  }`}>{ord.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min(totalOrders, (page - 1) * pageSize + 1)}-{Math.min(totalOrders, page * pageSize)} de {totalOrders} ordenes
          </span>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted/40 disabled:opacity-40"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1}
            >Anterior</button>
            <span className="text-xs text-muted-foreground">{page} / {pageCount}</span>
            <button
              className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted/40 disabled:opacity-40"
              onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
              disabled={page >= pageCount}
            >Siguiente</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
