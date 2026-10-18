import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { Invoice, InvoiceStatus } from "../types";

// invoices and orders reference each other (invoices.order_id and orders.invoice_id), so
// the embed must name the FK; a bare `orders(...)` makes PostgREST answer 300 (ambiguous).
const INVOICE_SELECT = "*, patients(first_name,last_name,id_number), orders!invoices_order_id_fkey(order_seq)";

/** Unpaginated list for a status (or several); used by the receivables view. */
export function useInvoices(orgId: string | null, status?: InvoiceStatus | InvoiceStatus[] | "all") {
  const statusKey = Array.isArray(status) ? status.join(",") : status ?? "all";
  return useQuery({
    queryKey: queryKeys.erp.invoices(orgId, statusKey),
    enabled: !!orgId,
    queryFn: async (): Promise<Invoice[]> => {
      let request = db.from("invoices").select(INVOICE_SELECT).eq("org_id", orgId).order("issued_at", { ascending: false });
      if (Array.isArray(status)) request = request.in("status", status);
      else if (status && status !== "all") request = request.eq("status", status);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Paginated list (1-based page) with the total count for the pager. */
export function useInvoicesPage(orgId: string | null, status: InvoiceStatus | "all", page: number, pageSize = 25) {
  return useQuery({
    queryKey: [...queryKeys.erp.invoices(orgId, status), "page", page, pageSize],
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: Invoice[]; total: number }> => {
      const from = (page - 1) * pageSize;
      let request = db
        .from("invoices")
        .select(INVOICE_SELECT, { count: "exact" })
        .eq("org_id", orgId)
        .order("issued_at", { ascending: false })
        .order("invoice_seq", { ascending: false })
        .range(from, from + pageSize - 1);
      if (status !== "all") request = request.eq("status", status);
      const { data, error, count } = await request;
      if (error) throw error;
      return { items: data ?? [], total: count ?? 0 };
    },
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.erp.invoice(invoiceId),
    enabled: !!invoiceId,
    queryFn: async (): Promise<Invoice> => {
      const { data, error } = await db.from("invoices").select(INVOICE_SELECT).eq("id", invoiceId).single();
      if (error) throw error;
      return data;
    },
  });
}

/** Orders of the lab that still have no invoice (created before the ERP was enabled). */
export function useBackfillPreview(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["erp", "backfill-preview", orgId ?? "none"],
    enabled: enabled && !!orgId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await db.rpc("erp_backfill_invoices", { p_org_id: orgId, p_from: null, p_dry_run: true });
      if (error) throw error;
      return Number(data?.orders ?? 0);
    },
  });
}

export function useBackfillInvoices(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await db.rpc("erp_backfill_invoices", { p_org_id: orgId, p_from: null, p_dry_run: false });
      if (error) throw error;
      return Number(data?.orders ?? 0);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["erp", "backfill-preview", orgId ?? "none"] });
      client.invalidateQueries({ queryKey: ["erp", "invoices", orgId ?? "none"] });
      client.invalidateQueries({ queryKey: ["erp", "report"] });
    },
  });
}
