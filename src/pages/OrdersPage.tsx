import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, DollarSign, ClipboardList, ChevronRight, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreateOrderDialog } from "@/features/orders/CreateOrderDialog";
import React from "react";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { StatCard } from "@/components/ui/StatCard";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useOrderStats, useOrdersList } from "@/features/orders/useOrders";

export default function OrdersPage() {
  const { organization } = useCurrentOrgContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 500);
  const { data: ordersData, isLoading } = useOrdersList(page, debouncedSearch, statusFilter);
  const { data: stats, isLoading: statsLoading } = useOrderStats();

  const orders = ordersData?.items ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalOrders / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Ordenes de Laboratorio"
        description="Gestiona y administra tus ordenes de laboratorio."
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
            <span>Nueva Orden</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4">
        <StatCard
          title="Total Ordenes Creadas"
          value={statsLoading ? "..." : stats?.total.toLocaleString()}
          icon={ClipboardList}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Creadas este Mes"
          value={statsLoading ? "..." : stats?.thisMonth.toLocaleString()}
          icon={Calendar}
          className="bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
        <StatCard
          title="Creadas Hoy"
          value={statsLoading ? "..." : stats?.today.toLocaleString()}
          icon={Plus}
          className="hidden md:block bg-white border-border shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      <Card className="bg-card rounded-xl border border-border p-0 shadow-sm">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-6 py-4 border-b border-border">
          <div className="md:flex md:flex-1 md:space-y-0 space-y-3 gap-3">
            <div className="relative md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre o cedula" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <Table className="w-full text-left border-collapse hidden md:table">
          <TableHeader>
            <TableRow className="bg-muted/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <TableHead>Paciente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Orden</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <React.Fragment key={order.id}>
                <TableRow className="cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{order.patients?.first_name} {order.patients?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{order.patients?.id_number}</p>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={order.status} /></TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-success" />
                        <span className="text-sm font-semibold mono">{Number(order.total_amount).toFixed(2)}</span>
                      </div>
                      {order.total_bs != null && (
                        <span className="text-xs text-muted-foreground mono">Bs. {Number(order.total_bs).toFixed(2)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold text-primary">
                      #{order.order_seq.toString().padStart(4, "0")}
                    </span>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>

        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground italic">Cargando Ordenes...</p>
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="py-20 text-center">
            <ClipboardList className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No se encontraron ordenes con estos datos</p>
          </div>
        )}

        <div className="md:hidden space-y-2 mb-4">
          {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Cargando ordenes...</div>}
          {!isLoading && orders.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron ordenes.</div>}
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-card rounded-xl border border-border overflow-hidden m-2"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="p-2 cursor-pointer active:bg-muted/30 transition-colors"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-md font-semibold truncate">{order.patients?.first_name} {order.patients?.last_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{order.patients?.id_number}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(order.created_at), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-success" />
                      <span className="text-md font-semibold mono">{Number(order.total_amount).toFixed(2)}</span>
                    </div>
                    {order.total_bs != null && (
                      <span className="text-sm text-muted-foreground mono">Bs. {Number(order.total_bs).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-sm text-muted-foreground">
            Mostrando <span className="text-foreground">{Math.min(totalOrders, (page - 1) * pageSize + 1)} a {Math.min(totalOrders, page * pageSize)}</span> de <span className="text-foreground">{totalOrders.toLocaleString()}</span> ordenes
          </span>
          <div className="flex items-center gap-1.5 pb-4 sm:pb-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={(e) => { e.stopPropagation(); setPage((prev) => Math.max(prev - 1, 1)); }}
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
              onClick={(e) => { e.stopPropagation(); setPage((prev) => Math.min(prev + 1, pageCount)); }}
              disabled={page >= pageCount}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        labData={{
          name: organization?.name || "Laboratorio",
          address: organization?.address || "",
          phone: organization?.phone || "",
          email: organization?.email || "",
          logo: organization?.logo_url || null,
          primary_color: organization?.primary_color || "#4f46e5",
        }}
      />
    </div>
  );
}
