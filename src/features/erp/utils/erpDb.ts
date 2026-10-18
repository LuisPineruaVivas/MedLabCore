import { supabase } from "@/integrations/supabase/client";

/**
 * Untyped Supabase client for ERP tables and RPCs, which are not in the generated
 * types until the ERP migrations are deployed. After `npm run update-types`, replace
 * imports of `erpDb` with the typed `supabase` client and delete this file.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const erpDb = supabase as unknown as {
  from: (table: string) => any;
  rpc: (name: string, args?: unknown) => Promise<{ data: any; error: Error | null }>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */
