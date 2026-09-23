import { createClient as createSupaClient } from "@supabase/supabase-js";

/** Admin API client — server actions only. Bypasses RLS by design. */
export function createAdminClient() {
  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}