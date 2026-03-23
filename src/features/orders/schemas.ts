export type OrderStatus = "pendiente" | "procesando" | "completada" | "cancelada";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface OrderRow {
  id: string;
  org_id: string;
  patient_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  exchange_rate: number | null;
  total_bs: number | null;
  notes: string | null;
  access_pin: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  order_seq: number;

}

export interface OrderItemRow {
  id: string;
  order_id: string;
  template_id: string | null;
  test_name: string;
  price_at_order: number;
  results_data: any;
  created_at: string;
  parent_profile_id: string | null;
  is_profile_header: boolean;
}

export interface OrderWithPatient extends OrderRow {
  patients: {
    id: string;
    first_name: string;
    last_name: string;
    id_number: string;
    date_of_birth: string;
    gender: string;
    phone: string | null;
    email: string | null;
  };
}

