import { useRef } from "react";
import { FlaskConical, Package, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CartItem, SearchItem } from "./createOrderUtils";

/** Step 2: search exams and profiles and add them to the order. */
export function CreateOrderExamPicker({
  testSearch,
  setTestSearch,
  filteredItems,
  cart,
  addToCart,
}: {
  testSearch: string;
  setTestSearch: (value: string) => void;
  filteredItems: SearchItem[];
  cart: CartItem[];
  addToCart: (item: SearchItem) => void;
}) {
  const testSearchInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="w-full space-y-4 h-full flex flex-col">
      <Label className="text-sm font-semibold">2. Selecciona los examenes a realizar</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={testSearchInputRef}
          className="pl-9"
          placeholder="Buscar examen..."
          value={testSearch}
          onChange={(event) => setTestSearch(event.target.value)}
        />
      </div>

      <div className="max-h-[32vh] overflow-y-auto divide-y divide-border rounded-lg border border-border lg:max-h-none">
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No se encontraron examenes con estos datos
          </p>
        ) : (
          filteredItems.map((item) => {
            const inCart =
              item.type === "exam"
                ? cart.some((cartItem) => cartItem.template_id === item.id && !cartItem.parentProfileId)
                : cart.some((cartItem) => cartItem.isProfileHeader && cartItem.profileId === item.id);

            return (
              <button
                key={`${item.type}-${item.id}`}
                className={cn(
                  "w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors",
                  inCart ? "bg-accent/40 cursor-default" : "hover:bg-muted/50"
                )}
                onClick={() => {
                  if (!inCart) {
                    addToCart(item);
                    setTestSearch("");
                    testSearchInputRef.current?.focus();
                  }
                }}
                disabled={inCart}
              >
                <div className="flex items-center gap-2">
                  {item.type === "profile" ? (
                    <Package className="w-4 h-4 text-primary" />
                  ) : (
                    <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.type === "profile" && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Perfil · {item.templateCount} examenes
                        </span>
                      )}
                    </div>
                    {item.type === "exam" && (
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">${item.price.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {!inCart && <Plus className="w-4 h-4 text-primary" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
