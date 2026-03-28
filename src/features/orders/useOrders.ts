import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { OrderWithPatient, OrderItemRow, OrderStatus } from "./schemas";
import { toast } from "@/hooks/use-toast";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("org_id, full_name, role, email")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useOrders(statusFilter?: OrderStatus) {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["orders", orgId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, patients(id, first_name, last_name, id_number, date_of_birth, gender, phone, email, address)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as OrderWithPatient[];
    },
    enabled: !!orgId,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from("orders")
        .select("*, patients(id, first_name, last_name, id_number, date_of_birth, gender, phone, email, address)")
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as unknown as OrderWithPatient;
    },
    enabled: !!orderId,
  });
}

export function useOrderItems(orderId: string | null) {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["order-items", orderId, orgId],
    queryFn: async () => {
      if (!orderId || !orgId) return [];

      const { data, error } = await supabase
        .from("order_items")
        .select(`
          *,
          test_templates(
            category,
            sort_order,
            organization_exam_settings!template_id(custom_sort_order)
          )
        `)
        .eq("order_id", orderId);

      if (error) throw error;

      return (data || []).map((item: any) => {
        // Extraemos el orden personalizado si existe para esta organización
        const settings = item.test_templates?.organization_exam_settings;
        // Buscamos el setting que corresponde a la org del perfil (por si la RLS fallara o devolviera array)
        const customOrder = Array.isArray(settings) 
          ? settings[0]?.custom_sort_order 
          : settings?.custom_sort_order;

        return {
          ...item,
          category: item.test_templates?.category || 'Otros',
          // Prioridad: 1. Orden personalizado, 2. Orden de plantilla, 3. Al final
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
      items,
      notes,
      exchangeRate,
      totalBs,
    }: {
      orgId: string;
      patientId: string;
      items: {
        template_id: string | null;
        test_name: string;
        price: number;
        schema: any;
        isProfileHeader?: boolean;
        profileId?: string;
        parentProfileId?: string;
      }[];
      notes?: string | null;
      exchangeRate?: number | null;
      totalBs?: number | null;
    }) => {
      const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          org_id: orgId,
          patient_id: patientId,
          total_amount: totalAmount,
          notes: notes || null,
          exchange_rate: exchangeRate ?? null,
          total_bs: totalBs ?? null,
        })
        .select("id, access_pin")
        .single();

      if (orderErr) throw orderErr;

      // Separate profile headers, profile children, and standalone exams
      const profileHeaders = items.filter((i) => i.isProfileHeader);
      const profileChildren = items.filter((i) => i.parentProfileId);
      const standaloneExams = items.filter((i) => !i.isProfileHeader && !i.parentProfileId);

      // Map from profileId -> inserted header row id
      const profileHeaderIdMap = new Map<string, string>();

      // 1. Insert profile header rows
      if (profileHeaders.length > 0) {
        for (const header of profileHeaders) {
          const { data: headerRow, error: headerErr } = await (supabase as any)
            .from("order_items")
            .insert({
              order_id: order.id,
              template_id: null,
              test_name: header.test_name,
              price_at_order: header.price,
              results_data: null,
              is_profile_header: true,
            })
            .select("id")
            .single();
          if (headerErr) throw headerErr;
          if (header.profileId) {
            profileHeaderIdMap.set(header.profileId, headerRow.id);
          }
        }
      }

      // 2. Insert profile child items
      if (profileChildren.length > 0) {
        const childRows = profileChildren.map((child) => {
          const parentId = child.parentProfileId
            ? profileHeaderIdMap.get(child.parentProfileId) || null
            : null;
          return {
            order_id: order.id,
            template_id: child.template_id,
            test_name: child.test_name,
            price_at_order: 0,
            results_data: buildEmptyResultsData(child.schema),
            parent_profile_id: parentId,
            is_profile_header: false,
          };
        });

        const { error: childErr } = await (supabase as any)
          .from("order_items")
          .insert(childRows);
        if (childErr) throw childErr;
      }

      // 3. Insert standalone exam items (same as before)
      if (standaloneExams.length > 0) {
        const examRows = standaloneExams.map((item) => ({
          order_id: order.id,
          template_id: item.template_id,
          test_name: item.test_name,
          price_at_order: item.price,
          results_data: buildEmptyResultsData(item.schema),
        }));

        const { error: examErr } = await supabase
          .from("order_items")
          .insert(examRows);
        if (examErr) throw examErr;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}


export function useSaveResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      resultsData,
    }: {
      itemId: string;
      resultsData;
    }) => {
      const { error } = await supabase
        .from("order_items")
        .update({ results_data: resultsData })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-items"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      completed_at,
    }: {
      orderId: string;
      status: OrderStatus;
      completed_at?: string | null;
    }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status, completed_at })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["order", variables.orderId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          status: variables.status,
          ...(variables.completed_at !== undefined ? { completed_at: variables.completed_at } : {}),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      toast({
        title: "Orden actualizada correctamente",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Error al actualizar la orden",
        variant: "destructive",
      });
    },
  });
}

function buildEmptyResultsData(schema) {
  if (!schema?.sections) return { sections: [] };
  return {
    sections: schema.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({
        ...field,
        value: "",
      })),
    })),
  };
}
