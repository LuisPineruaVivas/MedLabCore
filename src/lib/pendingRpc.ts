import { supabase } from "@/integrations/supabase/client";

/**
 * Calls an RPC whose migration is not in the generated types yet
 * (20261025010000_money_totals_and_bulk_results). After `supabase db push` and
 * `npm run update-types`, switch the callers to `supabase.rpc` and delete this file.
 * The result is `unknown`, so callers must validate it.
 */
export function pendingRpc(name: string, args: Record<string, unknown>) {
  return (supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: Error | null }>)(name, args);
}
