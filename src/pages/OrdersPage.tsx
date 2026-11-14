import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ClipboardList, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreateOrderDialog } from "@/features/orders/CreateOrderDialog";
import React from "react";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { cn } from "@/lib/utils";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useOrderStats, useOrdersList } from "@/features/orders/useOrders";
import { useAffiliateUsers } from "@/features/billing/useAffiliateAccounts";
import { Badge } from "@/components/ui/badge";

const formatUsd = (value: number | string | null) => `USD ${Number(value ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatBs = (value: number | string) => `Bs ${Number(value).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const orderNumber = (seq: number | null | undefined) => `#${String(seq ?? "").padStart(4, "0")}`;

export default function OrdersPage() {
  const { organization } = useCurrentOrgContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [affiliateOriginFilter, setAffiliateOriginFilter] = useState<"all" | "affiliate" | "internal">("all");
  const [affiliateUserId, setAffiliateUserId] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 500);
  const { data: affiliates = [] } = useAffiliateUsers();
  const affiliateUserIds = useMemo(() => affiliates.map((affiliate) => affiliate.id), [affiliates]);
  const affiliateById = useMemo(() => new Map(affiliates.map((affiliate) => [affiliate.id, affiliate])), [affiliates]);
  const { data: ordersData, isLoading } = useOrdersList(
    page,
    debouncedSearch,
    statusFilter,
    affiliateOriginFilter,
    affiliateUserId,
    affiliateUserIds,
  );
  const { data: stats } = useOrderStats();
  // The Bs amounts in every row come from this rate; the screen names it.
  const { data: liveRate } = useExchangeRate(organization?.id);
  // The status strip replaces the old KPI tiles: what needs the bench first, with its count.
  const statusTabs = [
    { value: "all", label: "Todas", count: stats?.total },
    { value: "pendiente", label: "Pendientes", count: stats?.pending },
    { value: "por_aprobar", label: "Por aprobar", count: stats?.toApprove },
    { value: "completada", label: "Completadas", count: stats?.completed },
    { value: "cancelada", label: "Canceladas", count: stats?.cancelled },
  ];
  // Open on the work that waits for the bench, once, until the user picks a filter.
  const [filterTouched, setFilterTouched] = useState(false);
  useEffect(() => {
    if (filterTouched || !stats) return;
    if (stats.pending > 0) setStatusFilter("pendiente");
    else if (stats.toApprove > 0) setStatusFilter("por_aprobar");
  }, [filterTouched, stats]);
  const awaitingWork = (status: string) => status === "pendiente" || status === "por_aprobar";

  const orders = ordersData?.items ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalOrders / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, affiliateOriginFilter, affiliateUserId]);

  useEffect(() => {
    if (affiliateOriginFilter === "internal") {
      setAffiliateUserId("all");
    }
  }, [affiliateOriginFilter]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Órdenes"
        description={liveRate?.rate ? `Tasa BCV de hoy: ${Number(liveRate.rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/USD` : "Busca una orden o filtra por estado."}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Nueva orden
          </Button>
        }
      />

      <div role="group" aria-label="Filtrar por estado" className="grid grid-cols-2 gap-1 rounded-2xl border border-input p-1.5 neu-inset sm:flex">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => { setFilterTouched(true); setStatusFilter(tab.value); }}
              className={cn(
                "neu-rise flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm first:col-span-2 sm:flex-1",
                active ? "border-border bg-card font-semibold text-foreground shadow-[var(--neu-raised-sm)]" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count != null && <span className={cn("tabular-nums font-bold", active && tab.value !== "all" && "text-primary")}>{tab.count}</span>}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-4 px-4 py-4 sm:px-6 border-b border-border">
          <div className="md:flex md:flex-1 md:space-y-0 space-y-3 gap-3">
            <div className="relative md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
              <Input className="pl-9" aria-label="Buscar órdenes" placeholder="Buscar por nombre o cédula" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {affiliates.length > 0 && (
              <Select value={affiliateOriginFilter} onValueChange={(value) => setAffiliateOriginFilter(value as "all" | "affiliate" | "internal")}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los orígenes</SelectItem>
                  <SelectItem value="affiliate">Laboratorios afiliados</SelectItem>
                  <SelectItem value="internal">Operación interna</SelectItem>
                </SelectContent>
              </Select>
            )}
            {affiliates.length > 0 && (
              <Select value={affiliateUserId} onValueChange={setAffiliateUserId} disabled={affiliateOriginFilter === "internal"}>
                <SelectTrigger className="w-full sm:w-[230px]">
                  <SelectValue placeholder="Laboratorio afiliado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los afiliados</SelectItem>
                  {affiliates.map((affiliate) => (
                    <SelectItem key={affiliate.id} value={affiliate.id}>
                      {affiliate.full_name || affiliate.email || "Afiliado sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <Table className="w-full text-left border-collapse hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Orden</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-10"><span className="sr-only">Abrir</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const affiliate = affiliateById.get(order.created_by);
              return <React.Fragment key={order.id}>
                <TableRow
                  className={cn(
                    "cursor-pointer",
                    // Waiting work reads pressed: a sunken band with shade along its top edge (vertical-only, so no seams between cells).
                    awaitingWork(order.status) && "bg-[hsl(var(--neu-lo)/0.16)] dark:bg-[hsl(var(--neu-lo)/0.55)] [&>td]:bg-[linear-gradient(to_bottom,hsl(var(--neu-lo)/0.5),transparent_9px)]",
                  )}
                  tabIndex={0}
                  aria-label={`Abrir orden ${orderNumber(order.order_seq)} de ${order.patients?.first_name ?? ""} ${order.patients?.last_name ?? ""}`}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/orders/${order.id}`); } }}
                >
                  <TableCell>
                    {/* Depth is the state: waiting work is pressed in, finished work stands raised. */}
                    <span className={cn(
                      "neu-rise inline-flex rounded-lg border px-2 py-1 font-semibold tabular-nums text-primary",
                      awaitingWork(order.status) ? "border-input bg-background shadow-[var(--neu-inset)]" : "border-border bg-card shadow-[var(--neu-raised)]",
                    )}>
                      {orderNumber(order.order_seq)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-semibold">{order.patients?.first_name} {order.patients?.last_name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{order.patients?.id_number}</p>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={order.status} /></TableCell>
                  <TableCell>
                    {affiliate ? (
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-info/40 text-info">Afiliado</Badge>
                        <p className="max-w-[190px] truncate text-xs font-medium" title={affiliate.full_name || affiliate.email || undefined}>
                          {affiliate.full_name || affiliate.email || "Laboratorio afiliado"}
                        </p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Interna</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatUsd(order.total_amount)}</p>
                    {order.total_bs != null && <p className="text-xs text-muted-foreground tabular-nums">{formatBs(order.total_bs)}</p>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground tabular-nums">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /></TableCell>
                </TableRow>
              </React.Fragment>;
            })}
          </TableBody>
        </Table>

        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground">Cargando órdenes…</p>
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="py-20 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden />
            <p className="text-sm font-medium">No hay órdenes con este filtro.</p>
            <p className="mt-1 text-sm text-muted-foreground">Cambia el estado o la búsqueda, o crea una orden nueva.</p>
          </div>
        )}

        <ul className="md:hidden space-y-3 p-3">
          {orders.map((order) => {
            const affiliate = affiliateById.get(order.created_by);
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className={cn(
                    "neu-rise w-full rounded-2xl border p-3.5 text-left",
                    // Waiting work sits pressed into the surface; finished work rises.
                    awaitingWork(order.status) ? "border-input bg-background shadow-[var(--neu-inset)]" : "bg-card shadow-[var(--neu-raised-sm)] active:shadow-[var(--neu-inset)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{order.patients?.first_name} {order.patients?.last_name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">{orderNumber(order.order_seq)} · {order.patients?.id_number}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "dd/MM/yyyy")} · {affiliate ? `Afiliado: ${affiliate.full_name || affiliate.email || "sin nombre"}` : "Interna"}
                    </p>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatUsd(order.total_amount)}</p>
                      {order.total_bs != null && <p className="text-xs text-muted-foreground tabular-nums">{formatBs(order.total_bs)}</p>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
          <span className="text-sm text-muted-foreground tabular-nums">
            <span className="text-foreground">{Math.min(totalOrders, (page - 1) * pageSize + 1)}–{Math.min(totalOrders, page * pageSize)}</span> de <span className="text-foreground">{totalOrders.toLocaleString("es-VE")}</span> órdenes
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              className="h-9 w-9"
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
                  aria-label={`Página ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className="h-9 w-9 tabular-nums"
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
                aria-label={`Página ${pageCount}`}
                className="h-9 min-w-9 px-2 tabular-nums"
                onClick={(e) => { e.stopPropagation(); setPage(pageCount); }}
              >
                {pageCount}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              className="h-9 w-9"
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
