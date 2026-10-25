import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { ilikeAny } from "@/lib/postgrest";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { getUserFacingErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { PatientFormData } from "./schemas";

export function usePatientsList(page: number, search: string) {
  const { orgId } = useCurrentOrgContext();
  const pageSize = 10;

  return useQuery({
    queryKey: queryKeys.patients.list(orgId, { page, search }),
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("patients")
        .select(
          `
            id,
            org_id,
            id_number,
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone,
            email,
            address,
            occupation,
            created_at,
            pending_exams:orders(count)
          `,
          { count: "exact" }
        )
        .eq("org_id", orgId!)
        .neq("orders.status", "completada")
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.or(ilikeAny(["first_name", "last_name", "id_number"], search));
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

export function usePatientStats() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.patients.stats(orgId),
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [total, month, day] = await Promise.all([
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId!)
          .gte("created_at", firstDayOfMonth.toISOString()),
        supabase
          .from("patients")
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

export function useCreatePatient() {
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrgContext();

  return useMutation({
    mutationFn: async (formData: PatientFormData) => {
      const { error } = await supabase.from("patients").insert([
        {
          id_number: formData.id_number,
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth.toISOString().slice(0, 10),
          gender: formData.gender,
          org_id: orgId!,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          occupation: formData.occupation || null,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.all(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.stats(orgId) });
    },
  });
}

export function usePatientSearch(search: string) {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: queryKeys.patients.search(orgId, search),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, id_number, first_name, last_name, date_of_birth, gender, phone")
        .eq("org_id", orgId!)
        .or(ilikeAny(["id_number", "first_name", "last_name"], search))
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && search.trim().length >= 2,
  });
}

export function usePatientDetail(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patients.detail(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, id_number, first_name, last_name, date_of_birth, gender, phone, email, address, occupation, created_at")
        .eq("id", patientId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });
}

export function usePatientOrders(patientId: string | null) {
  return useQuery({
    queryKey: queryKeys.patients.orders(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, patient_id, status, total_amount, total_bs, notes, created_at, access_pin")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });
}

export function useUpdatePatient(patientId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PatientFormData) => {
      const { error } = await supabase
        .from("patients")
        .update({
          id_number: data.id_number,
          first_name: data.first_name,
          last_name: data.last_name,
          date_of_birth: data.date_of_birth.toISOString().slice(0, 10),
          gender: data.gender,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          occupation: data.occupation || null,
        })
        .eq("id", patientId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.detail(patientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.orders(patientId) });
      toast.success("Paciente actualizado correctamente");
    },
    onError: (error) => {
      toast.error(getUserFacingErrorMessage(error, "No se pudo actualizar el paciente"));
    },
  });
}
