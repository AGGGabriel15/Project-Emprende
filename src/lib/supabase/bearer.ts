import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Sesión de la app móvil: el access token de Supabase llega en
 * `Authorization: Bearer <token>`. El cliente resultante actúa como ese
 * usuario, así que RLS aplica igual que en el web.
 */
export async function authFromRequest(request: Request): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user ? { supabase, user } : null;
}
