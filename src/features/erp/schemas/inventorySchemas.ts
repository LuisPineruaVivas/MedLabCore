import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const nonNegative = (message: string) => z.coerce.number({ invalid_type_error: message }).min(0, message);

export const itemSchema = z
  .object({
    code: optionalText(40),
    name: z.string().trim().min(2, "Indica el nombre del insumo").max(120),
    description: optionalText(500),
    category: z.enum(["reagent", "consumable", "equipment_part", "office_supply", "other"]),
    unit_of_measure: z.enum(["units", "boxes", "packs", "ml", "l", "mg", "g", "kg", "tests", "strips", "other"]),
    units_per_package: z.coerce.number().positive("Debe ser mayor que cero"),
    min_stock: nonNegative("El mínimo no puede ser negativo"),
    max_stock: z.union([z.literal(""), nonNegative("El máximo no puede ser negativo")]).optional(),
    storage_condition: optionalText(120),
    is_active: z.boolean(),
    is_trackable: z.boolean(),
    // Only used when creating: loaded as an 'initial' Kardex movement.
    initial_stock: nonNegative("El stock inicial no puede ser negativo").optional(),
    initial_unit_cost: nonNegative("El costo no puede ser negativo").optional(),
  })
  .refine((values) => values.max_stock === "" || values.max_stock === undefined || values.max_stock >= values.min_stock, {
    message: "El máximo debe ser mayor o igual al mínimo",
    path: ["max_stock"],
  });

export type ItemFormValues = z.infer<typeof itemSchema>;

export const purchaseSchema = z.object({
  item_id: z.string().uuid("Selecciona un insumo"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor que cero"),
  unit_cost: nonNegative("El costo no puede ser negativo"),
  supplier_name: optionalText(120),
  purchase_invoice_ref: optionalText(60),
  lot_number: optionalText(60),
  expiration_date: optionalText(10),
  notes: optionalText(500),
});

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export const adjustmentSchema = z.object({
  item_id: z.string().uuid("Selecciona un insumo"),
  direction: z.enum(["in", "out"]),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor que cero"),
  reason: z.string().trim().min(3, "Indica el motivo del ajuste").max(500),
});

export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;
