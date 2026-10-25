import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PackagePlus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useItems } from "../hooks/useInventory";
import { useConfirmOrderConsumption, useOrderBomPreview, type OrderSignature } from "../hooks/useOrderConsumption";
import {
  buildConsumptionDraft,
  buildExtraLine,
  duplicateExamLines,
  linesMissingReason,
  summarizeConsumption,
  toConsumptionInputs,
  type ConsumptionDraftLine,
} from "../utils/consumption";
import { formatCurrency, formatUnitCost } from "../utils/currencyFormatters";
import { getErpErrorMessage } from "../utils/erpErrors";
import { formatQuantity, UNIT_LABELS } from "../utils/inventory";

interface ConsumptionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: { id: string; org_id: string; order_seq?: number | null };
  signature: OrderSignature;
  onCompleted?: () => void;
}

const isChanged = (line: ConsumptionDraftLine) => line.is_extra || (line.recipe_quantity !== null && Number(line.quantity) !== line.recipe_quantity);

/**
 * Shown when an ERP lab approves an order: lists the supplies its exams consume
 * (from the recipes), lets the bioanalyst adjust them, add extras or repeat an exam,
 * and then discounts the stock and completes the order in one step.
 */
export function ConsumptionConfirmDialog({ open, onOpenChange, order, signature, onCompleted }: ConsumptionConfirmDialogProps) {
  const { data: preview, isLoading, isError, error } = useOrderBomPreview(order.id, open);
  const { data: items = [] } = useItems(open ? order.org_id : null);
  const confirm = useConfirmOrderConsumption(order.org_id);
  const [lines, setLines] = useState<ConsumptionDraftLine[]>([]);
  const [extraItemId, setExtraItemId] = useState("");
  const keyCounter = useRef(0);

  useEffect(() => {
    if (open && preview) setLines(buildConsumptionDraft(preview));
  }, [open, preview]);

  const summary = useMemo(() => summarizeConsumption(lines), [lines]);
  const missingReasons = linesMissingReason(lines);
  const exams = useMemo(() => {
    const groups = new Map<string, { name: string; lines: ConsumptionDraftLine[] }>();
    lines.forEach((line) => {
      const key = line.order_item_id ?? "extras";
      const group = groups.get(key) ?? { name: key === "extras" ? "Insumos adicionales" : line.test_name ?? "Examen", lines: [] };
      group.lines.push(line);
      groups.set(key, group);
    });
    return [...groups.entries()];
  }, [lines]);

  const update = (key: string, data: Partial<ConsumptionDraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...data } : line)));
  const nextKey = () => ++keyCounter.current;

  function addExtra() {
    const item = items.find((candidate) => candidate.id === extraItemId);
    if (!item) return;
    setLines((current) => [...current, buildExtraLine(item, nextKey())]);
    setExtraItemId("");
  }

  function handleConfirm() {
    confirm.mutate(
      { orderId: order.id, consumptions: toConsumptionInputs(lines), signature },
      {
        onSuccess: (result) => {
          toast.success(
            result?.lines
              ? `Orden completada. Se descontaron ${result.lines} consumo(s) por ${formatCurrency(result.total_cost)}.`
              : "Orden completada sin consumo de insumos."
          );
          onOpenChange(false);
          onCompleted?.();
        },
        onError: (mutationError) => toast.error(getErpErrorMessage(mutationError)),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Confirmar consumo de insumos{order.order_seq ? ` — Orden #${order.order_seq}` : ""}</DialogTitle>
          <DialogDescription>
            Estos insumos se descontarán del inventario según las recetas de los exámenes. Ajusta las cantidades si hubo diferencias.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando consumo...</p>
        ) : isError ? (
          <p className="text-sm text-destructive">{getErpErrorMessage(error)}</p>
        ) : (
          <div className="space-y-4">
            {!lines.length && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Los exámenes de esta orden no tienen receta de insumos. Puedes agregar insumos manualmente o completar la orden sin consumo.
              </p>
            )}

            {exams.map(([groupKey, group]) => (
              <section key={groupKey} className="rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                  <p className="text-sm font-semibold">{group.name}</p>
                  {groupKey !== "extras" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setLines((current) => duplicateExamLines(current, groupKey, nextKey()))}
                    >
                      <Repeat className="mr-1 h-3.5 w-3.5" />Repetir examen
                    </Button>
                  )}
                </div>
                <div className="divide-y">
                  {group.lines.map((line) => (
                    <div key={line.key} className="space-y-2 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-sm">
                          {line.item_name}
                          {line.is_extra && line.order_item_id && <span className="ml-1 text-xs text-muted-foreground">(repetición)</span>}
                        </p>
                        <Input
                          className="h-8 w-24 text-right"
                          type="number"
                          min="0"
                          step="any"
                          value={line.quantity}
                          onChange={(event) => update(line.key, { quantity: Number(event.target.value) })}
                          aria-label={`Cantidad de ${line.item_name}`}
                        />
                        <span className="w-14 text-xs text-muted-foreground">{UNIT_LABELS[line.unit_of_measure]}</span>
                        {line.is_extra ? (
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Quitar" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="w-8" />
                        )}
                      </div>
                      {isChanged(line) && (
                        <Input
                          className={cn("h-8 text-xs", !line.reason.trim() && "border-amber-400")}
                          placeholder={line.recipe_quantity !== null ? `Receta: ${line.recipe_quantity}. Motivo del ajuste (obligatorio)` : "Motivo (obligatorio)"}
                          value={line.reason}
                          onChange={(event) => update(line.key, { reason: event.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={extraItemId} onValueChange={setExtraItemId}>
                <SelectTrigger className="sm:flex-1"><SelectValue placeholder="Agregar insumo extra (gasto imprevisto)..." /></SelectTrigger>
                <SelectContent>
                  {items.filter((item) => item.is_active).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} · stock {formatQuantity(item.current_stock, item.unit_of_measure)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addExtra} disabled={!extraItemId}><PackagePlus className="mr-1 h-4 w-4" />Agregar</Button>
            </div>

            {summary.rows.length > 0 && (
              <section className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold">Totales de consumo</p>
                <div className="space-y-1 text-sm">
                  {summary.rows.map((row) => (
                    <div key={row.item_id} className={cn("flex justify-between gap-2", row.shortage > 0 && "text-destructive")}>
                      <span>
                        {row.item_name}: {formatQuantity(row.quantity, row.unit_of_measure)} × {formatUnitCost(row.unit_cost)}
                        {row.shortage > 0 && ` — faltan ${formatQuantity(row.shortage, row.unit_of_measure)} (stock ${formatQuantity(row.current_stock)})`}
                      </span>
                      <span>{formatCurrency(row.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Costo total de producción</span>
                  <span>{formatCurrency(summary.totalCost)}</span>
                </div>
              </section>
            )}

            {summary.hasShortage && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />No hay stock suficiente. Registra la compra o un ajuste en Inventario antes de completar.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || isError || confirm.isPending || summary.hasShortage || missingReasons.length > 0}
          >
            {confirm.isPending ? "Confirmando..." : "Confirmar y completar orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
