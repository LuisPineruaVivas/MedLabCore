import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrderItemRow } from "@/features/orders/schemas";

interface PatientPortalOrderItem extends OrderItemRow {
  category?: string;
  resolved_sort_order?: number;
}

interface PatientSession {
  patient_id: string;
  patient_info: {
    first_name: string;
    last_name: string;
    id_number: string;
    date_of_birth: string;
    gender: string;
    phone?: string;
    email?: string;
  };
}

interface OrderWithItems {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  access_pin: string;
  org_name: string;
  org_logo_url?: string;
  order_seq: number;
  firma_url: string | null;
  sello_url: string | null;
  departmentOrder: string[];
  items: PatientPortalOrderItem[];
}

export function usePatientSession() {
  const [session, setSession] = useState<PatientSession | null>(null);

  const authenticate = async (dni: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use the SECURITY DEFINER RPC — no direct table access as anon.
      // Only returns data if both DNI and PIN match an existing order.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("portal_authenticate", {
        p_dni: dni.trim(),
        p_pin: pin.trim().toUpperCase(),
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        return {
          success: false,
          error: "No se encontró ninguna orden con esos datos. Verifica tu cédula y PIN e intenta de nuevo.",
        };
      }

      const patient = Array.isArray(data) ? data[0] : data;

      setSession({
        patient_id: patient.patient_id,
        patient_info: {
          first_name:    patient.first_name,
          last_name:     patient.last_name,
          id_number:     patient.id_number,
          date_of_birth: patient.date_of_birth,
          gender:        patient.gender,
          phone:         patient.phone  ?? undefined,
          email:         patient.email  ?? undefined,
        },
      });

      return { success: true };
    } catch {
      return { success: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
    }
  };

  const logout = () => {
    setSession(null);
  };

  return { session, authenticate, logout };
}

export function usePatientOrders(patientId: string | null, pin: string | null) {
  return useQuery({
    queryKey: ["patient-orders", patientId, pin],
    queryFn: async (): Promise<OrderWithItems[]> => {
      if (!patientId) return [];

      const { data, error } = await (supabase.rpc as any)("portal_get_patient_orders", {
        p_patient_id: patientId,
        p_pin: pin.trim().toUpperCase()
      });

      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];

      return data.map((row: {
        order_id: string;
        created_at: string;
        status: string;
        total_amount: number;
        access_pin: string;
        org_name: string;
        org_logo_url: string | null;
        order_seq: number;
        firma_url: string | null;
        sello_url: string | null;
        department_order: unknown;
        items: PatientPortalOrderItem[];
      }) => ({
        id:           row.order_id,
        created_at:   row.created_at,
        status:       row.status,
        total_amount: row.total_amount,
        access_pin:   row.access_pin,
        org_name:     row.org_name ?? "Laboratorio",
        org_logo_url: row.org_logo_url ?? undefined,
        order_seq:    row.order_seq,
        firma_url:    row.firma_url ?? null,
        sello_url:    row.sello_url ?? null,
        departmentOrder: Array.isArray(row.department_order)
          ? row.department_order.filter((item): item is string => typeof item === "string")
          : [],
        items:        Array.isArray(row.items) ? row.items : [],
      }));
    },
    enabled: !!patientId && !!pin,
  });
}
