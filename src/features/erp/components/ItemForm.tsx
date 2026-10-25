import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { itemSchema, type ItemFormValues } from "../schemas/inventorySchemas";
import type { Item, ItemCategory, UnitOfMeasure } from "../types";
import { ITEM_CATEGORY_LABELS, UNIT_LABELS } from "../utils/inventory";

const defaults: ItemFormValues = {
  code: "",
  name: "",
  description: "",
  category: "consumable",
  unit_of_measure: "units",
  units_per_package: 1,
  min_stock: 0,
  max_stock: "",
  storage_condition: "",
  is_active: true,
  is_trackable: true,
  initial_stock: 0,
  initial_unit_cost: 0,
};

interface ItemFormProps {
  item?: Item | null;
  pending: boolean;
  onSubmit: (values: ItemFormValues) => void;
}

function itemFormValues(item?: Item | null): ItemFormValues {
  if (!item) return defaults;
  return {
    ...defaults,
    code: item.code ?? "",
    name: item.name,
    description: item.description ?? "",
    category: item.category,
    unit_of_measure: item.unit_of_measure,
    units_per_package: Number(item.units_per_package),
    min_stock: Number(item.min_stock),
    max_stock: item.max_stock === null ? "" : Number(item.max_stock),
    storage_condition: item.storage_condition ?? "",
    is_active: item.is_active,
    is_trackable: item.is_trackable,
  };
}

// Mount with key={item?.id ?? "new"}: values are read once at mount, so the
// selects always show the saved category and unit when editing.
export function ItemForm({ item, pending, onSubmit }: ItemFormProps) {
  const form = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema), defaultValues: itemFormValues(item) });
  const isNew = !item;
  const unitLabel = UNIT_LABELS[form.watch("unit_of_measure")] ?? "";
  const error = (name: keyof ItemFormValues) => form.formState.errors[name]?.message;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="item-name">Nombre</Label>
          <Input id="item-name" placeholder="Tubo morado EDTA" {...form.register("name")} />
          <p className="text-xs text-destructive">{error("name")}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-code">Código</Label>
          <Input id="item-code" placeholder="R-001" {...form.register("code")} />
        </div>
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select value={form.watch("category")} onValueChange={(value) => form.setValue("category", value as ItemCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Unidad de medida</Label>
          <Select value={form.watch("unit_of_measure")} onValueChange={(value) => form.setValue("unit_of_measure", value as UnitOfMeasure)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(UNIT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">La unidad en la que lo usas: el stock y las recetas se cuentan así.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-package">Unidades por empaque</Label>
          <Input id="item-package" type="number" min="0.01" step="0.01" {...form.register("units_per_package")} />
          <p className="text-xs text-muted-foreground">Cuántos {unitLabel} trae cada caja o paquete. Permite registrar compras por empaque.</p>
          <p className="text-xs text-destructive">{error("units_per_package")}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-min">Stock mínimo (alerta)</Label>
          <Input id="item-min" type="number" min="0" step="any" {...form.register("min_stock")} />
          <p className="text-xs text-destructive">{error("min_stock")}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-max">Stock máximo (opcional)</Label>
          <Input id="item-max" type="number" min="0" step="any" {...form.register("max_stock")} />
          <p className="text-xs text-destructive">{error("max_stock")}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="item-storage">Condición de almacenamiento</Label>
          <Input id="item-storage" placeholder="Refrigerado 2–8 °C, temperatura ambiente..." {...form.register("storage_condition")} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="item-description">Descripción</Label>
          <Textarea id="item-description" rows={2} {...form.register("description")} />
        </div>
      </div>

      {isNew && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-sm font-medium">Inventario inicial (opcional)</p>
          <p className="mb-2 text-xs text-muted-foreground">Se registra en el Kardex como movimiento de inventario inicial.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="item-initial-stock">Cantidad ({unitLabel})</Label>
              <Input id="item-initial-stock" type="number" min="0" step="any" {...form.register("initial_stock")} />
              <p className="text-xs text-destructive">{error("initial_stock")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-initial-cost">Costo por {unitLabel} USD</Label>
              <Input id="item-initial-cost" type="number" min="0" step="0.0001" {...form.register("initial_unit_cost")} />
              <p className="text-xs text-destructive">{error("initial_unit_cost")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.watch("is_active")} onCheckedChange={(value) => form.setValue("is_active", value)} />
          Activo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.watch("is_trackable")} onCheckedChange={(value) => form.setValue("is_trackable", value)} />
          Descontar automáticamente al consumir
        </label>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Guardando..." : isNew ? "Crear insumo" : "Guardar cambios"}</Button>
    </form>
  );
}
