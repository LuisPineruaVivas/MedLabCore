import type { MicrobiologyFieldDef } from "@/features/microbiology/types";
import type { EditableOrderItem, OrderItemResultsState, OrderResultFieldState, OrderResultSectionState } from "./useOrderResultsEditor";

// Shared types of the order detail screen (results editor, sidebar, panel).
export type PatientInfo = {
  name: string;
  id: string;
  date: string;
  age: number | string;
  gender: string;
};

export type OrganizationInfo = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  watermark_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  city?: string | null;
  rif: string | null;
  report_footer_text?: string | null;
  profiles?: {
    full_name: string;
  } | null;
};

export type ResultField = OrderResultFieldState;
export type ResultSection = OrderResultSectionState;
export type ItemResultsData = OrderItemResultsState;
export type OrderItem = EditableOrderItem & {
  test_name?: string;
  price_at_order?: number;
  template_schema?: { microbiology_fields?: MicrobiologyFieldDef[] } | null;
};

export type OrderWithPatient = {
  id: string;
  status: "pendiente" | "por_aprobar" | "procesando" | "completada" | "cancelada";
  total_amount: number;
  total_bs?: number | null;
  access_pin?: string | null;
  patients: {
    phone?: string | null;
    email?: string | null;
  };
};
