import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role: ignora RLS. Solo para webhooks, crons y
 * operaciones de servidor ya autorizadas. Nunca importarlo desde el cliente.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient solo puede usarse en el servidor.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
