import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { browserSession } from "@/features/auth/actions";

type BrowserSession = { accessToken: string; userId: string; expiresAt: number };

let cached: BrowserSession | null = null;
let loading: Promise<BrowserSession | null> | null = null;

/**
 * Sesión del navegador. Las cookies de Supabase son HttpOnly, así que el
 * servidor entrega solo el access token (se renueva un minuto antes de vencer).
 */
export async function getBrowserSession() {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached;
  loading ??= browserSession()
    .then((session) => (cached = session))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Al entrar o salir: la próxima petición pide el token de la nueva sesión. */
export function forgetBrowserSession() {
  cached = null;
}

let client: SupabaseClient | undefined;

export function createClient() {
  client ??= createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => (await getBrowserSession())?.accessToken ?? null,
  });
  return client;
}

/**
 * Cliente listo para Realtime: el socket se une a los canales con el token de la
 * sesión. Sin esto se une como anónimo y la RLS descarta los INSERT/UPDATE.
 */
export async function createRealtimeClient() {
  const supabase = createClient();
  await supabase.realtime.setAuth();
  return supabase;
}
