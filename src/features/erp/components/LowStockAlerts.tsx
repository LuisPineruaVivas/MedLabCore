import { AlertTriangle } from "lucide-react";
import type { Item } from "../types";
import { formatQuantity, getLowStockItems } from "../utils/inventory";

export function LowStockAlerts({ items, onSelect }: { items: Item[]; onSelect?: (item: Item) => void }) {
  const lowStock = getLowStockItems(items);
  if (!lowStock.length) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        {lowStock.length === 1 ? "1 insumo está" : `${lowStock.length} insumos están`} en o por debajo del stock mínimo
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {lowStock.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item)}
            className="rounded-md border border-amber-300 bg-background/70 px-2 py-1 text-xs hover:bg-background dark:border-amber-700"
          >
            {item.name}: {formatQuantity(item.current_stock, item.unit_of_measure)} / mín. {formatQuantity(item.min_stock)}
          </button>
        ))}
      </div>
    </div>
  );
}
