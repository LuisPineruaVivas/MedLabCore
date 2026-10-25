import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useKardex } from "../hooks/useInventory";
import type { Item } from "../types";
import { formatCurrency, formatUnitCost } from "../utils/currencyFormatters";
import { formatQuantity, TRANSACTION_LABELS } from "../utils/inventory";

const KARDEX_PAGE = 50;

/** Movement history of one supply, newest first, with stock and WAC before/after each movement. */
export function KardexView({ item }: { item: Item }) {
  const [limit, setLimit] = useState(KARDEX_PAGE);
  const { data: movements = [], isLoading, isFetching } = useKardex(item.id, limit);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <div><p className="text-muted-foreground">Stock actual</p><p className="font-semibold">{formatQuantity(item.current_stock, item.unit_of_measure)}</p></div>
        <div><p className="text-muted-foreground">Costo promedio</p><p className="font-semibold">{formatUnitCost(item.unit_cost)}</p></div>
        <div><p className="text-muted-foreground">Valor</p><p className="font-semibold">{formatCurrency(item.total_value)}</p></div>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}>Cargando movimientos...</TableCell></TableRow>
            ) : movements.length ? (
              movements.map((movement) => {
                const quantity = Number(movement.quantity);
                const detail = [movement.supplier_name, movement.purchase_invoice_ref && `Fact. ${movement.purchase_invoice_ref}`, movement.lot_number && `Lote ${movement.lot_number}`, movement.notes]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(movement.transaction_date), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="whitespace-nowrap">{TRANSACTION_LABELS[movement.transaction_type]}</TableCell>
                    <TableCell className={cn("text-right font-medium", quantity > 0 ? "text-emerald-600" : "text-destructive")}>
                      {quantity > 0 ? "+" : "−"}{formatQuantity(Math.abs(quantity))}
                    </TableCell>
                    <TableCell className="text-right">{formatUnitCost(movement.unit_cost_at_time)}</TableCell>
                    <TableCell className="text-right">{formatQuantity(movement.new_stock)}</TableCell>
                    <TableCell className="text-right">{formatUnitCost(movement.new_unit_cost)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={detail}>{detail || "—"}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin movimientos todavía.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {movements.length >= limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit((value) => value + KARDEX_PAGE)} disabled={isFetching}>
          {isFetching ? "Cargando..." : "Cargar movimientos anteriores"}
        </Button>
      )}
    </div>
  );
}
