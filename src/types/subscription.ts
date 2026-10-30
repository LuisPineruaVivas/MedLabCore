export type SubscriptionPaymentStatus = "pending" | "approved" | "rejected";

export interface SubscriptionPayment {
  id: string;
  org_id: string;
  amount_usd: number;
  amount_bs: number | null;
  exchange_rate: number | null;
  payment_method: string;
  reference_number: string;
  payment_date: string;
  proof_url: string;
  notes: string | null;
  status: SubscriptionPaymentStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  organizations?: {
    id: string;
    name: string;
    rif: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface ReportPaymentPayload {
  org_id: string;
  amount_usd: number;
  amount_bs?: number | null;
  exchange_rate?: number | null;
  payment_method: string;
  reference_number: string;
  payment_date: string;
  proof_file: File;
  notes?: string | null;
}

export interface SubscriptionStatusInfo {
  expiresAt: string | null;
  graceUntil: string | null;
  isActive: boolean;
  isExpired: boolean;
  isInGrace: boolean;
  isWarning: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  isBlocked: boolean;
  statusText: string;
}

export interface SuperAdminMetrics {
  summary: {
    total_organizations: number;
    active_subscriptions: number;
    expired_subscriptions: number;
    expiring_soon_subscriptions: number;
    pending_payments: number;
    approved_payments: number;
    rejected_payments: number;
    total_patients: number;
    total_orders: number;
    orders_month: number;
    orders_today: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    rif: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    is_active: boolean | null;
    subscription_active: boolean;
    subscription_expires_at: string | null;
    subscription_grace_until: string | null;
    created_at: string | null;
    admin_name: string | null;
    admin_email: string | null;
    total_patients: number;
    total_orders: number;
    orders_this_month: number;
    orders_today: number;
    latest_payment: {
      id: string;
      status: SubscriptionPaymentStatus;
      payment_date: string;
      amount_usd: number;
      created_at: string;
    } | null;
  }>;
}
