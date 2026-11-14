import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isDemo, DEMO_AUTH_KEY } from '@/lib/demo/isDemo';
import { demoFetch, DEMO_SUPABASE_URL, ensureDemoSession } from '@/lib/demo/demoFetch';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!isDemo && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error(
    '[Supabase] Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set. ' +
    'Copy .env.example to .env and fill in your project credentials.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

if (isDemo) ensureDemoSession();

// Demo mode: every request is answered in-browser by demoFetch against a fake host, so nothing reaches the real project.
export const supabase = isDemo
  ? createClient<Database>(DEMO_SUPABASE_URL, 'demo-anon-key', {
      auth: {
        storage: sessionStorage,
        storageKey: DEMO_AUTH_KEY,
        persistSession: true,
        autoRefreshToken: false,
      },
      global: { fetch: demoFetch },
    })
  : createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
