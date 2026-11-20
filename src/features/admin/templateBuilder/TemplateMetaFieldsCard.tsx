import { Controller, type UseFormRegister, type Control, type FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestTemplateFormData, TEMPLATE_CATEGORIES } from "@/features/tests/schemas";

/** Name, department, price, table header option and result type of the template. */
export function TemplateMetaFieldsCard({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<TestTemplateFormData>;
  control: Control<TestTemplateFormData>;
  errors: FieldErrors<TestTemplateFormData>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Información General
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nombre del Examen</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Hemograma Completo"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-category">Departamento</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="tpl-category">
                    <SelectValue placeholder="Selecciona un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <p className="text-xs text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-price">Precio del Examen</Label>
            <Input
              id="tpl-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="25.00"
              {...register("base_price")}
            />
            {errors.base_price && (
              <p className="text-xs text-destructive">
                {errors.base_price.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="flex items-center space-x-2 h-10">
              <Controller
                control={control}
                name="schema.hide_table_header"
                render={({ field }) => (
                  <Switch
                    id="tpl-hide-header"
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="tpl-hide-header" className="cursor-pointer">Ocultar Encabezado de Tabla</Label>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-3 pt-2 border-t border-border/60">
            <Label htmlFor="tpl-result-type" className="font-semibold text-foreground">
              Tipo / Estructura del Examen
            </Label>
            <Controller
              control={control}
              name="result_type"
              render={({ field }) => (
                <Select
                  value={field.value || "STANDARD"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="tpl-result-type" className="w-full sm:w-80">
                    <SelectValue placeholder="Selecciona la estructura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">
                      Estándar / Cuantitativo (Campos y rangos personalizables)
                    </SelectItem>
                    <SelectItem value="MICROBIOLOGY">
                      Microbiología / Cultivo (Muestra, Gram y Antibiograma dinámico)
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Selecciona "Microbiología" para exámenes de cultivos bacteriológicos que requieren antibiogramas.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
