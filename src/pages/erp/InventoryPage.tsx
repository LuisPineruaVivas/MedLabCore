import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, Boxes, PackagePlus, Pencil, Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/ui/StatCard";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { useErpModule } from "@/hooks/useErpModule";
import { AdjustmentDialog } from "@/features/erp/components/AdjustmentDialog";
import { ItemForm } from "@/features/erp/components/ItemForm";
import { KardexView } from "@/features/erp/components/KardexView";
import { LowStockAlerts } from "@/features/erp/components/LowStockAlerts";
import { PurchaseEntryDialog } from "@/features/erp/components/PurchaseEntryDialog";
import { useItems, useSaveItem } from "@/features/erp/hooks/useInventory";
import type { ItemFormValues } from "@/features/erp/schemas/inventorySchemas";
import type { Item, ItemCategory } from "@/features/erp/types";
import { formatCurrency, formatUnitCost } from "@/features/erp/utils/currencyFormatters";
import { getErpErrorMessage } from "@/features/erp/utils/erpErrors";
import { formatQuantity, getLowStockItems, isLowStock, ITEM_CATEGORY_LABELS, matchesItemSearch, totalInventoryValue } from "@/features/erp/utils/inventory";

type MovementDialog = { kind: "purchase" | "adjustment"; itemId: string | null } | null;

export default function InventoryPage() {
  const { orgId } = useCurrentOrgContext();
  const { canManageInventory } = useErpModule();
  const { data: items = [], isLoading } = useItems(orgId);
  const save = useSaveItem(orgId);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Item | null | undefined>();
  const [kardexItemId, setKardexItemId] = useState<string | null>(null);
  const [movement, setMovement] = useState<MovementDialog>(null);

  const visible = useMemo(
    () =>
      items.filter(
        (item) => (showInactive || item.is_active) && (category === "all" || item.category === category) && matchesItemSearch(item, search)
      ),
    [items, showInactive, category, search]
  );
  const activeItems = items.filter((item) => item.is_active);
  const kardexItem = items.find((item) => item.id === kardexItemId) ?? null;

  function handleSave(values: ItemFormValues) {
    save.mutate(
      { id: editing?.id, values },
      {
        onSuccess: (result) => {
          if (result.initialError) {
            toast.warning(`Insumo creado, pero no se cargó el stock inicial: ${getErpErrorMessage(result.initialError)}`);
          } else {
            toast.success(editing ? "Insumo actualizado." : "Insumo creado.");
          }
          setEditing(undefined);
        },
        onError: (error) => toast.error(getErpErrorMessage(error)),
      }
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inventario de insumos"
        description="Stock, costo promedio ponderado y Kardex de reactivos y consumibles."
        actions={
          canManageInventory && (
            <>
              <Button variant="outline" onClick={() => setMovement({ kind: "adjustment", itemId: null })} disabled={!items.length}>
                <ArrowDownUp className="mr-2 h-4 w-4" />Ajuste
              </Button>
              <Button variant="outline" onClick={() => setMovement({ kind: "purchase", itemId: null })} disabled={!activeItems.length}>
                <PackagePlus className="mr-2 h-4 w-4" />Registrar compra
              </Button>
              <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Nuevo insumo</Button>
            </>
          )
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="Valor del inventario" value={formatCurrency(totalInventoryValue(items))} subtitle="Stock × costo promedio" icon={Wallet} />
        <StatCard title="Insumos activos" value={activeItems.length} icon={Boxes} />
        <StatCard title="Bajo stock mínimo" value={getLowStockItems(items).length} icon={AlertTriangle} />
      </div>

      <LowStockAlerts items={items} onSelect={(item) => setKardexItemId(item.id)} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o código..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={category} onValueChange={(value) => setCategory(value as ItemCategory | "all")}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />Mostrar inactivos
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}>Cargando insumos...</TableCell></TableRow>
            ) : visible.length ? (
              visible.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setKardexItemId(item.id)}>
                  <TableCell className="text-muted-foreground">{item.code ?? "—"}</TableCell>
                  <TableCell>
                    <p className="font-medium">{item.name}</p>
                    {!item.is_active && <Badge variant="secondary">Inactivo</Badge>}
                  </TableCell>
                  <TableCell>{ITEM_CATEGORY_LABELS[item.category]}</TableCell>
                  <TableCell className="text-right">
                    <span className={isLowStock(item) ? "font-semibold text-destructive" : undefined}>
                      {formatQuantity(item.current_stock, item.unit_of_measure)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatQuantity(item.min_stock)}</TableCell>
                  <TableCell className="text-right">{formatUnitCost(item.unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total_value)}</TableCell>
                  <TableCell className="text-right">
                    {canManageInventory && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar insumo"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(item);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {items.length ? "Ningún insumo coincide con los filtros." : "Aún no hay insumos. Crea el primero para empezar a llevar el Kardex."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar insumo" : "Nuevo insumo"}</DialogTitle></DialogHeader>
          <ItemForm item={editing} pending={save.isPending} onSubmit={handleSave} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!kardexItem} onOpenChange={(open) => !open && setKardexItemId(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Kardex: {kardexItem?.name}{kardexItem?.code ? ` (${kardexItem.code})` : ""}</DialogTitle>
          </DialogHeader>
          {kardexItem && (
            <>
              {canManageInventory && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!kardexItem.is_active} onClick={() => setMovement({ kind: "purchase", itemId: kardexItem.id })}>
                    <PackagePlus className="mr-1 h-4 w-4" />Compra
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMovement({ kind: "adjustment", itemId: kardexItem.id })}>
                    <ArrowDownUp className="mr-1 h-4 w-4" />Ajuste
                  </Button>
                </div>
              )}
              <KardexView key={kardexItem.id} item={kardexItem} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <PurchaseEntryDialog
        orgId={orgId}
        items={items}
        itemId={movement?.itemId}
        open={movement?.kind === "purchase"}
        onOpenChange={(open) => !open && setMovement(null)}
      />
      <AdjustmentDialog
        orgId={orgId}
        items={items}
        itemId={movement?.itemId}
        open={movement?.kind === "adjustment"}
        onOpenChange={(open) => !open && setMovement(null)}
      />
    </div>
  );
}
