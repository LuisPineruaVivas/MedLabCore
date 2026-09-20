import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";

export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  userId?: string;
  actionCategory?: string; // 'all' | 'orders' | 'patients' | 'templates' | 'security' | 'financial'
  dateFrom?: string; // ISO date string YYYY-MM-DD
  dateTo?: string; // ISO date string YYYY-MM-DD
  search?: string;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { orgId } = useCurrentOrgContext();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 15;
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: queryKeys.auditLogs.list(orgId, {
      page,
      pageSize,
      userId: filters.userId ?? "all",
      actionCategory: filters.actionCategory ?? "all",
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      search: filters.search ?? "",
    }),
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (orgId) {
        query = query.eq("org_id", orgId);
      }

      if (filters.userId && filters.userId !== "all") {
        query = query.eq("user_id", filters.userId);
      }

      // Filter by actionCategory
      if (filters.actionCategory && filters.actionCategory !== "all") {
        switch (filters.actionCategory) {
          case "orders":
            query = query.eq("entity_type", "orders");
            break;
          case "patients":
            query = query.eq("entity_type", "patients");
            break;
          case "templates":
            query = query.eq("entity_type", "test_templates");
            break;
          case "security":
            query = query.in("action", ["ROLE_CHANGED", "USER_ORG_TRANSFERRED", "SUPERADMIN_IMPERSONATION_START", "SUPERADMIN_IMPERSONATION_END"]);
            break;
          case "financial":
            query = query.in("action", ["EXCHANGE_RATE_UPDATED", "ORDER_PAYMENT_CHANGED"]);
            break;
        }
      }

      // Date range filter
      if (filters.dateFrom) {
        query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
      }

      // General search filter
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        query = query.or(`user_name.ilike.%${term}%,action.ilike.%${term}%`);
      }

      const { data, error, count } = await query.range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      return {
        logs: (data ?? []) as AuditLogRow[],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
    enabled: !!orgId,
  });
}

export function useOrgUsersForFilter() {
  const { orgId } = useCurrentOrgContext();

  return useQuery({
    queryKey: ["org-users-filter", orgId ?? "none"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("org_id", orgId!)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}
