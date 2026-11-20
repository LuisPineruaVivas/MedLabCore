export type PaymentMethodType = "cash" | "bank_transfer" | "mobile_payment" | "zelle" | "pos_terminal" | "other";
export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "overdue" | "cancelled" | "credit_note";

export interface ExchangeRateHistory {
  id: string; org_id: string; from_currency: string; to_currency: string; rate: number;
  source: string; effective_date: string; created_at: string; created_by: string | null;
}
export interface BankAccount {
  id: string; org_id: string; name: string; method_type: PaymentMethodType; currency: string;
  description: string | null; bank_name: string | null; account_number: string | null;
  account_holder: string | null; phone_number: string | null; email: string | null;
  is_active: boolean; sort_order: number; opening_balance: number; opening_date: string;
  created_at: string; updated_at: string;
}
export interface Invoice {
  id: string; org_id: string; invoice_number: string; invoice_seq: number; order_id: string;
  patient_id: string; subtotal_usd: number; discount_pct: number; discount_amount: number;
  tax_pct: number; tax_amount: number; total_usd: number; exchange_rate_id: string | null;
  exchange_rate: number | null; total_local: number | null; amount_paid_usd: number;
  balance_due_usd: number; status: InvoiceStatus; issued_at: string; due_date: string | null;
  paid_at: string | null; cancelled_at: string | null; notes: string | null; is_exempted: boolean;
  created_at: string; updated_at: string; created_by: string;
  patients?: { first_name: string; last_name: string; id_number: string } | null;
  orders?: { order_seq: number } | null;
}

export interface PaymentSchedule { id: string; invoice_id: string; installment_number: number; amount_due_usd: number; amount_paid_usd: number; due_date: string; status: "pending" | "partial" | "paid" | "overdue" | "cancelled"; notes: string | null; }


export interface Payment { id: string; invoice_id: string; amount: number; currency: string; amount_usd: number; exchange_rate: number | null; payment_method: string; method_type: PaymentMethodType; reference_number: string | null; payment_date: string; is_void: boolean; void_reason: string | null; }

/** Account balance from `get_account_balances` (admins only). */
export interface AccountBalance {
  account_id: string; name: string; currency: string; is_active: boolean;
  opening_balance: number; opening_date: string; balance: number; balance_usd: number | null;
}

export type MovementKind = "income" | "expense" | "transfer_in" | "transfer_out" | "adjustment_in" | "adjustment_out";
/** Kinds listed by `get_finance_movements`: movements plus order payments. */
export type FinanceEntryKind = MovementKind | "order_payment";

export interface FinanceCategory { id: string; org_id: string | null; name: string; kind: "income" | "expense"; is_active: boolean; sort_order: number; }

/** One row of `get_finance_movements`. signed_amount is in the account currency (negative = money out). */
export interface FinanceEntry {
  source: "payment" | "movement"; id: string; account_id: string; account_name: string; kind: FinanceEntryKind;
  signed_amount: number; currency: string; amount_usd: number | null; exchange_rate: number | null;
  entry_date: string; created_at: string; category_id: string | null; category_name: string | null;
  description: string | null; reference_number: string | null; transfer_id: string | null;
  invoice_id: string | null; order_id: string | null; is_void: boolean; void_reason: string | null;
  /** Admins only. */
  running_balance?: number;
}
export interface FinanceMovementsPage { total: number; rows: FinanceEntry[]; }

/** Cash-basis figures from `get_finance_dashboard` (USD). */
export interface FinanceDashboard {
  date_from: string; date_to: string; order_income_usd: number; other_income_usd: number; income_usd: number;
  expenses_usd: number; profit_usd: number;
  expenses_by_category: { category: string; amount_usd: number }[];
  monthly: { month: string; income_usd: number; expenses_usd: number }[];
}

/** Totals from `get_receivables_overview` (USD). */
export interface ReceivablesOverview {
  as_of: string; total_usd: number; open_invoices: number; unscheduled_usd: number; unscheduled_count: number;
  overdue_usd: number; overdue_count: number; due_week_usd: number; due_week_count: number; due_month_usd: number; due_month_count: number;
}

/** Who owes and for which order, embedded in receivables rows. */
export interface ReceivableInvoiceRef {
  id: string; invoice_number: string; order_id: string; balance_due_usd: number; status: InvoiceStatus;
  patients: { first_name: string; last_name: string; id_number: string; phone: string | null } | null;
  orders: { order_seq: number } | null;
}
export type InstallmentRow = PaymentSchedule & { invoices: ReceivableInvoiceRef };
export type OpenBalanceRow = ReceivableInvoiceRef & { issued_at: string; total_usd: number; payment_schedules: { id: string; status: string }[] };

export type PayableStatus = "pending" | "partial" | "paid" | "cancelled";
/** A bill the lab owes. amount_paid and status are maintained from its payment movements. */
export interface Payable {
  id: string; org_id: string; category_id: string; payee: string | null; description: string; reference_number: string | null;
  amount: number; currency: string; amount_paid: number; status: PayableStatus; due_date: string | null;
  inventory_transaction_id: string | null; cancelled_at: string | null; cancel_reason: string | null; created_at: string;
  finance_categories?: { name: string } | null;
}
/** Open bills per currency, from `get_payables_summary`. */
export interface PayablesSummaryRow { currency: string; pending: number; overdue: number; count: number; overdue_count: number; }

export type ItemCategory = "reagent" | "consumable" | "equipment_part" | "office_supply" | "other";
export type UnitOfMeasure = "units" | "boxes" | "packs" | "ml" | "l" | "mg" | "g" | "kg" | "tests" | "strips" | "other";
export type InventoryTransactionType =
  | "purchase" | "consumption" | "adjustment_in" | "adjustment_out" | "return" | "transfer_in" | "transfer_out" | "initial";

/** Supply catalog row. current_stock, unit_cost (WAC) and total_value are maintained by the Kardex trigger. */
export interface Item {
  id: string; org_id: string; code: string | null; name: string; description: string | null;
  category: ItemCategory; unit_of_measure: UnitOfMeasure; units_per_package: number;
  current_stock: number; min_stock: number; max_stock: number | null; unit_cost: number; total_value: number;
  lot_number: string | null; expiration_date: string | null; storage_condition: string | null;
  is_active: boolean; is_trackable: boolean; created_at: string; updated_at: string;
}

export interface InventoryTransaction {
  id: string; org_id: string; item_id: string; transaction_type: InventoryTransactionType;
  quantity: number; unit_cost_at_time: number; prev_stock: number; new_stock: number;
  prev_unit_cost: number; new_unit_cost: number; reference_type: string | null; reference_id: string | null;
  supplier_name: string | null; purchase_invoice_ref: string | null; lot_number: string | null;
  expiration_date: string | null; notes: string | null; transaction_date: string; created_by: string;
}

/** Recipe line: how much of a supply one exam consumes by default. */
export interface TestMaterial {
  id: string; org_id: string; template_id: string; item_id: string; quantity_per_test: number; notes: string | null;
  items?: Pick<Item, "id" | "name" | "code" | "unit_of_measure" | "unit_cost" | "is_active"> | null;
}

/** Row returned by `get_order_bom_preview`: one exam × supply. */
export interface BomPreviewLine {
  order_item_id: string; test_name: string; item_id: string; item_name: string; item_code: string | null;
  unit_of_measure: UnitOfMeasure; quantity: number; unit_cost: number; current_stock: number;
}

export interface ConsumptionInput {
  item_id: string; quantity: number; order_item_id?: string | null; was_adjusted?: boolean; is_extra?: boolean; reason?: string | null;
}

export interface FinancialSummary {
  date_from: string; date_to: string;
  collected_usd: number; payments_count: number; collected_today_usd: number; previous_collected_usd: number;
  billed_usd: number; invoices_count: number; receivables_usd: number; receivables_count: number; overdue_usd: number;
  supply_cost_usd: number;
  by_method: { name: string; method_type: PaymentMethodType; total_usd: number; count: number }[];
  by_currency: { currency: string; amount: number; amount_usd: number }[];
  daily: { date: string; total_usd: number }[];
}

export interface ProfitabilityTestRow {
  test_name: string; performed: number; sold: number; revenue_usd: number; cost_usd: number;
  avg_price_usd: number | null; avg_cost_usd: number | null; margin_pct: number | null;
}
export interface ProfitabilityReport {
  date_from: string; date_to: string; orders_count: number;
  revenue_usd: number; supply_cost_usd: number; gross_profit_usd: number; margin_pct: number | null;
  unassigned_cost_usd: number; exempted_cost_usd: number; by_test: ProfitabilityTestRow[];
}

export interface InventorySummary {
  date_from: string; date_to: string; total_value_usd: number; active_items: number;
  low_stock: { id: string; name: string; code: string | null; unit_of_measure: UnitOfMeasure; current_stock: number; min_stock: number }[];
  expiring_soon: { id: string; name: string; lot_number: string | null; expiration_date: string; current_stock: number; unit_of_measure: UnitOfMeasure }[];
  value_by_category: { category: ItemCategory; value_usd: number; items: number }[];
  purchases_usd: number; consumption_usd: number; losses_usd: number;
  top_consumed: { item_id: string; name: string; unit_of_measure: UnitOfMeasure; quantity: number; cost_usd: number }[];
}

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
export interface ReceivablesReport {
  as_of: string; total_usd: number; invoices_total: number; buckets: Record<AgingBucket, number>;
  invoices: {
    id: string; invoice_number: string; patient_name: string; id_number: string; issued_at: string;
    effective_due: string; days_overdue: number; bucket: AgingBucket; total_usd: number; balance_due_usd: number; status: InvoiceStatus;
  }[];
}
