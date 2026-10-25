import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { InventoryTransaction, Item } from "../types";
import type { AdjustmentFormValues, ItemFormValues, PurchaseFormValues } from "../schemas/inventorySchemas";

const emptyToNull = (value: string | undefined | null) => (value && value.trim() ? value.trim() : null);

export function useItems(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.erp.items(orgId),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await db.from("items").select("*").eq("org_id", orgId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useKardex(itemId: string | null | undefined, limit = 200) {
  return useQuery({
    queryKey: [...queryKeys.erp.kardex(itemId), limit],
    placeholderData: keepPreviousData,
    enabled: !!itemId,
    queryFn: async (): Promise<InventoryTransaction[]> => {
      const { data, error } = await db
        .from("inventory_transactions")
        .select("*")
        .eq("item_id", itemId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidateInventory(orgId: string | null) {
  const client = useQueryClient();
  return (itemId?: string) => {
    client.invalidateQueries({ queryKey: queryKeys.erp.items(orgId) });
    if (itemId) client.invalidateQueries({ queryKey: queryKeys.erp.kardex(itemId) });
  };
}

/**
 * Creates or edits catalog data. Stock and cost are never sent: on creation the
 * optional opening stock is registered as an 'initial' Kardex movement.
 */
export function useSaveItem(orgId: string | null) {
  const invalidate = useInvalidateInventory(orgId);
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ItemFormValues }) => {
      if (!orgId) throw new Error("No hay organización seleccionada.");
      const payload = {
        org_id: orgId,
        code: emptyToNull(values.code),
        name: values.name.trim(),
        description: emptyToNull(values.description),
        category: values.category,
        unit_of_measure: values.unit_of_measure,
        units_per_package: values.units_per_package,
        min_stock: values.min_stock,
        max_stock: values.max_stock === "" || values.max_stock === undefined ? null : values.max_stock,
        storage_condition: emptyToNull(values.storage_condition),
        is_active: values.is_active,
        is_trackable: values.is_trackable,
      };

      if (id) {
        const { error } = await db.from("items").update(payload).eq("id", id);
        if (error) throw error;
        return { id, initialError: null };
      }

      const { data, error } = await db.from("items").insert(payload).select("id").single();
      if (error) throw error;

      let initialError: Error | null = null;
      if (values.initial_stock && values.initial_stock > 0) {
        const result = await db.rpc("register_purchase", {
          p_org_id: orgId,
          p_item_id: data.id,
          p_quantity: values.initial_stock,
          p_unit_cost: values.initial_unit_cost ?? 0,
          p_notes: "Carga inicial de inventario",
          p_is_initial: true,
        });
        initialError = result.error;
      }
      return { id: data.id as string, initialError };
    },
    onSuccess: (result) => invalidate(result.id),
  });
}

export function useRegisterPurchase(orgId: string | null) {
  const invalidate = useInvalidateInventory(orgId);
  return useMutation({
    mutationFn: async (values: PurchaseFormValues) => {
      const { data, error } = await db.rpc("register_purchase", {
        p_org_id: orgId,
        p_item_id: values.item_id,
        p_quantity: values.quantity,
        p_unit_cost: values.unit_cost,
        p_supplier_name: emptyToNull(values.supplier_name),
        p_purchase_invoice_ref: emptyToNull(values.purchase_invoice_ref),
        p_lot_number: emptyToNull(values.lot_number),
        p_expiration_date: emptyToNull(values.expiration_date),
        p_notes: emptyToNull(values.notes),
        p_is_initial: false,
      });
      if (error) throw error;
      return data as { new_stock: number; new_unit_cost: number };
    },
    onSuccess: (_data, values) => invalidate(values.item_id),
  });
}

export function useRegisterAdjustment(orgId: string | null) {
  const invalidate = useInvalidateInventory(orgId);
  return useMutation({
    mutationFn: async (values: AdjustmentFormValues) => {
      const { data, error } = await db.rpc("register_adjustment", {
        p_org_id: orgId,
        p_item_id: values.item_id,
        p_direction: values.direction,
        p_quantity: values.quantity,
        p_reason: values.reason,
      });
      if (error) throw error;
      return data as { new_stock: number; new_unit_cost: number };
    },
    onSuccess: (_data, values) => invalidate(values.item_id),
  });
}
