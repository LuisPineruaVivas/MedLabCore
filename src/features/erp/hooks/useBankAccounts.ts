import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpDb as db } from "../utils/erpDb";
import { queryKeys } from "@/lib/queryKeys";
import type { BankAccount } from "../types";
import type { BankAccountFormValues } from "../schemas/bankAccountSchema";

export function useBankAccounts(orgId: string | null, activeOnly = false) {
  return useQuery({ queryKey: queryKeys.erp.bankAccounts(orgId, activeOnly), enabled: !!orgId, queryFn: async (): Promise<BankAccount[]> => {
    let request = db.from("bank_accounts").select("*").eq("org_id", orgId).order("sort_order").order("name");
    if (activeOnly) request = request.eq("is_active", true);
    const { data, error } = await request;
    if (error) throw error;
    return data ?? [];
  }});
}

export function useSaveBankAccount(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ id, values }: { id?: string; values: BankAccountFormValues }) => {
    if (!orgId) throw new Error("No hay organización seleccionada.");
    const payload = { ...values, org_id: orgId, description: values.description || null, bank_name: values.bank_name || null, account_number: values.account_number || null, phone_number: values.phone_number || null, email: values.email || null };
    const request = id ? db.from("bank_accounts").update(payload).eq("id", id) : db.from("bank_accounts").insert(payload);
    const { error } = await request;
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.erp.bankAccounts(orgId, false) }) });
}
