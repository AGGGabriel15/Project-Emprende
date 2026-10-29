import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

/**
 * Cliente listo para Realtime: el socket se une a los canales con el token de la
 * sesión. Sin esto se une como anónimo y la RLS descarta los INSERT/UPDATE.
 */
export async function createRealtimeClient() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session?.access_token ?? null);
  return supabase;
}
