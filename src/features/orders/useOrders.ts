import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingErrorMessage } from "@/lib/errors";
import type { OrderWithPatient, OrderStatus } from "./schemas";
import { toast } from "@/hooks/use-toast";

export interface CreateOrderItemInput {
  template_id: string | null;
  test_name: string;
  price: number;
  schema: unknown;
  isProfileHeader?: boolean;
  profileId?: string;
  parentProfileId?: string;
}

interface CreateLabOrderResponse {
  success: boolean;
  orderId: string;
  access_pin: string | null;
  order_seq: number | null;
  userSafeMessage: string;
  technicalCode: string;
}

export function buildCreateLabOrderPayload({
  orgId,
  patientId,
  createdBy,
  items,
  notes,
  exchangeRate,
  totalBs,
  isExempted,
}: {
  orgId: string;
  patientId: string;
  createdBy: string;
  items: CreateOrderItemInput[];
  notes?: string | null;
  exchangeRate?: number | null;
  totalBs?: number | null;
  isExempted?: boolean;
}) {
  return {
    p_org_id: orgId,
    p_patient_id: patientId,
    p_notes: notes ?? null,
    p_exchange_rate: exchangeRate ?? null,
    p_total_bs: totalBs ?? null,
    p_is_exempted: isExempted ?? false,
    p_items: items as unknown as Json,
    p_created_by: createdBy,
  };
}

export function getOrderStatusInvalidationTargets(orderId: string, orgId?: string | null) {
  return [
    queryKeys.orders.all(orgId),
    queryKeys.orders.stats(orgId),
    queryKeys.dashboard.recentOrders(orgId),
    ["billing-orders", orgId ?? "none"] as const,
    queryKeys.orders.detail(orderId),
  ];
}

export function getSaveResultsInvalidationTargets(orderId: string, orgId?: string | null) {
  return [
    queryKeys.orders.items(orderId, orgId),
    queryKeys.orders.detail(orderId),
  ];
}

export function useProfile() {
  const { profile, isLoading } = useCurrentOrgContext();
  return {
    data: profile,
    isLoading,
  };
}

export function useOrganization() {
  const { organization, isLoading } = useCurrentOrgContext();
  return {
    data: organization,
    isLoading,
  };
}

export function useOrders(statusFilter?: OrderStatus) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.orders.list(orgId, { statusFilter: statusFilter ?? "all" }),
    queryFn: async () => {
      const query = supabase
        .from("orders")
        .select(
          "id, org_id, patient_id, status, payment_status, total_amount, is_exempted, exchange_rate, total_bs, notes, access_pin, created_at, updated_at, completed_at, order_seq, firma_url, firma_name, sello_url, signature_footer_text, patients(id, first_name, last_name, id_number, date_of_birth, gender, phone, email, address)"
        )
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });

      const { data, error } = statusFilter
        ? await query.eq("status", statusFilter)
        : await query;

      if (error) throw error;
      return (data ?? []) as unknown as OrderWithPatient[];
    },
    enabled: !!orgId,
  });
}

export function useOrdersList(
  page: number,
  search: string,
  statusFilter: string,
  affiliateOriginFilter: "all" | "affiliate" | "internal" = "all",
  affiliateUserId = "all",
  affiliateUserIds: string[] = [],
) {
  const { orgId } = useCurrentOrgContext();
  const pageSize = 10;

  return useQuery({
    queryKey: queryKeys.orders.list(orgId, {
      page,
      search,
      statusFilter,
      affiliateOriginFilter,
      affiliateUserId,
      affiliateUserIds: affiliateUserIds.join(","),
    }),
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const searchTerm = search.trim();

      let query = supabase
        .from("orders")
        .select(
          `
            id,
            created_by,
            status,
            total_amount,
            is_exempted,
            total_bs,
            created_at,
            order_seq,
            patients!inner(id, first_name, last_name, id_number, date_of_birth, gender, phone, email, address)
          `,
          { count: "exact" }
        )
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as OrderStatus);
      }

      if (affiliateUserId !== "all") {
        query = query.eq("created_by", affiliateUserId);
      } else if (affiliateOriginFilter === "affiliate") {
        query = query.in("created_by", affiliateUserIds);
      } else if (affiliateOriginFilter === "internal" && affiliateUserIds.length > 0) {
        query = query.not("created_by", "in", `(${affiliateUserIds.join(",")})`);
      }

      if (searchTerm) {
        const searchFilter = `%${searchTerm}%`;
        query = query.or(
          `first_name.ilike.${searchFilter},last_name.ilike.${searchFilter},id_number.ilike.${searchFilter}`,
          { foreignTable: "patients" }
        );
      }

      const { data, error, count } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;

      return {
        items: data ?? [],
        total: count ?? 0,
      };
    },
    enabled: !!orgId,
  });
}

export function useOrderStats() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.orders.stats(orgId),
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [total, month, day] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", firstDayOfMonth.toISOString()),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", today.toISOString()),
      ]);

      return {
        total: total.count || 0,
        thisMonth: month.count || 0,
        today: day.count || 0,
      };
    },
    enabled: !!orgId,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, org_id, patient_id, status, payment_status, total_amount, is_exempted, exchange_rate, total_bs, notes, access_pin, created_at, updated_at, completed_at, order_seq, firma_url, firma_name, sello_url, patients(id, first_name, last_name, id_number, date_of_birth, gender, phone, email, address)"
        )
        .eq("id", orderId!)
        .single();

      if (error) throw error;
      return data as unknown as OrderWithPatient;
    },
    enabled: !!orderId,
  });
}

export function useOrderItems(orderId: string | null) {
  const { orgId } = useCurrentOrgContext();

  return useQuery<any[]>({
    queryKey: queryKeys.orders.items(orderId, orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          template_id,
          test_name,
          price_at_order,
          results_data,
          test_method_id,
          method_name,
          created_at,
          parent_profile_id,
          is_profile_header,
          test_templates(
            category,
            sort_order,
            schema,
            organization_exam_settings!template_id(custom_sort_order)
          )
        `)
        .eq("order_id", orderId!);

      if (error) throw error;

      return (data || []).map((item: any) => {
        const settings = item.test_templates?.organization_exam_settings;
        const customOrder = Array.isArray(settings) ? settings[0]?.custom_sort_order : settings?.custom_sort_order;

        return {
          ...item,
          category: item.test_templates?.category || "Pruebas Especiales",
          resolved_sort_order: customOrder ?? item.test_templates?.sort_order ?? 9999,
        };
      });
    },
    enabled: !!orderId && !!orgId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orgId,
      patientId,
      createdBy,
      items,
      notes,
      exchangeRate,
      totalBs,
      isExempted,
    }: {
      orgId: string;
      patientId: string;
      createdBy: string;
      items: CreateOrderItemInput[];
      notes?: string | null;
      exchangeRate?: number | null;
      totalBs?: number | null;
      isExempted?: boolean;
    }) => {
      const { data, error } = await supabase.rpc("create_lab_order", buildCreateLabOrderPayload({
        orgId,
        patientId,
        createdBy,
        items,
        notes,
        exchangeRate,
        totalBs,
        isExempted,
      }));

      if (error) throw error;
      return data as unknown as CreateLabOrderResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(variables.orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.stats(variables.orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentOrders(variables.orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(variables.orgId, undefined) });
    },
  });
}

export function useSaveResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      orderId,
      orgId,
      resultsData,
      testMethodId,
      methodName,
    }: {
      itemId: string;
      orderId: string;
      orgId: string | null | undefined;
      resultsData: Json;
      testMethodId?: string | null;
      methodName?: string | null;
    }) => {
      const { error } = await supabase
        .from("order_items")
        .update({ results_data: resultsData, test_method_id: testMethodId ?? null, method_name: methodName ?? null })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      getSaveResultsInvalidationTargets(variables.orderId, variables.orgId).forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      orgId,
      status,
      completed_at,
      firma_url,
      firma_name,
      sello_url,
      signature_footer_text,
    }: {
      orderId: string;
      orgId?: string | null;
      status: OrderStatus;
      completed_at?: string | null;
      firma_url?: string | null;
      firma_name?: string | null;
      sello_url?: string | null;
      signature_footer_text?: string | null;
    }) => {
      const updatePayload: {
        status: OrderStatus;
        completed_at?: string | null;
        firma_url?: string | null;
        firma_name?: string | null;
        sello_url?: string | null;
        signature_footer_text?: string | null;
      } = { status };

      if (completed_at !== undefined) updatePayload.completed_at = completed_at;
      if (firma_url !== undefined) updatePayload.firma_url = firma_url;
      if (firma_name !== undefined) updatePayload.firma_name = firma_name;
      if (sello_url !== undefined) updatePayload.sello_url = sello_url;
      if (signature_footer_text !== undefined) updatePayload.signature_footer_text = signature_footer_text;

      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(queryKeys.orders.detail(variables.orderId), (oldData: OrderWithPatient | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          status: variables.status,
          ...(variables.completed_at !== undefined ? { completed_at: variables.completed_at } : {}),
          ...(variables.firma_url !== undefined ? { firma_url: variables.firma_url } : {}),
          ...(variables.firma_name !== undefined ? { firma_name: variables.firma_name } : {}),
          ...(variables.sello_url !== undefined ? { sello_url: variables.sello_url } : {}),
          ...(variables.signature_footer_text !== undefined ? { signature_footer_text: variables.signature_footer_text } : {}),
        };
      });
      getOrderStatusInvalidationTargets(variables.orderId, variables.orgId).forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
      toast({
        title: "Orden actualizada correctamente",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: getUserFacingErrorMessage(error, "Error al actualizar la orden"),
        variant: "destructive",
      });
    },
  });
}
