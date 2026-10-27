import { Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CartItem } from "./createOrderUtils";

/** The order summary: selected exams, exemption switch, totals in USD and Bs. */
export function CreateOrderCartSummary({
  cart,
  handleRemoveCartItem,
  canExemptOrder,
  isExempted,
  setIsExempted,
  total,
  totalBs,
  effectiveTotals,
  currentRate,
}: {
  cart: CartItem[];
  handleRemoveCartItem: (item: CartItem) => void;
  canExemptOrder: boolean;
  isExempted: boolean;
  setIsExempted: (value: boolean) => void;
  total: number;
  totalBs: number | null;
  effectiveTotals: { total: number; totalBs: number | null };
  currentRate: number | null;
}) {
  return (
    <div className="w-full space-y-4 h-full flex flex-col">
      <Label className="text-sm font-semibold">Resumen de la orden</Label>
      <div className="h-auto min-h-52 rounded-lg border border-border lg:h-full">
        {cart.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No has seleccionado ningun examen
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">
                    Examen
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">
                    Categoria
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">
                    Precio
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
            </table>
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full">
                <tbody className="divide-y divide-border">
                  {cart.map((item, index) => (
                    <tr
                      key={`${item.template_id || item.profileId}-${index}`}
                      className={cn(
                        item.isProfileHeader && "bg-primary/5",
                        item.parentProfileId && "bg-muted/10"
                      )}
                    >
                      <td className="px-3 py-2 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          {item.parentProfileId && (
                            <span className="text-muted-foreground">└</span>
                          )}
                          {item.isProfileHeader && (
                            <Package className="w-3.5 h-3.5 text-primary" />
                          )}
                          {item.test_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {item.category}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold mono text-right">
                        {item.price > 0
                          ? `$${item.price.toFixed(2)}`
                          : item.parentProfileId
                            ? ""
                            : "$0.00"}
                      </td>
                      <td className="px-2 py-2">
                        {!item.parentProfileId && (
                          <button
                            onClick={() => handleRemoveCartItem(item)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2.5 bg-muted/20 border-t border-border space-y-1 mt-auto">
              {canExemptOrder && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/80 px-3 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="order-exempt-switch" className="text-sm font-semibold cursor-pointer">
                      Exonerar Orden
                    </Label>
                  </div>
                  <Switch
                    id="order-exempt-switch"
                    checked={isExempted}
                    onCheckedChange={setIsExempted}
                    aria-label="Exonerar orden"
                  />
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Total USD</span>
                  {isExempted && <Badge variant="secondary">Exonerado</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {isExempted && (
                    <span className="text-sm mono text-muted-foreground line-through">
                      ${total.toFixed(2)}
                    </span>
                  )}
                  <span className="text-base font-bold mono text-primary">
                    ${effectiveTotals.total.toFixed(2)}
                  </span>
                </div>
              </div>
              {effectiveTotals.totalBs !== null && currentRate && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Total BS (Tasa: {currentRate.toFixed(2)})
                  </span>
                  <div className="flex items-center gap-2">
                    {isExempted && totalBs !== null && (
                      <span className="text-xs mono text-muted-foreground line-through">
                        Bs. {totalBs.toFixed(2)}
                      </span>
                    )}
                    <span className="text-sm font-bold mono text-foreground">
                      Bs. {effectiveTotals.totalBs.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
