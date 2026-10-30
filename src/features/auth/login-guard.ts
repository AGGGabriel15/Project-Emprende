import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** IP del visitante (Vercel la pone primera en x-forwarded-for). */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "";
}

export function tooManyAttemptsMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Demasiados intentos fallidos. Espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} e inténtalo de nuevo.`;
}

/**
 * Inicio de sesión con contraseña con límite de intentos (lo usan el web y la
 * app). Si la base no responde, no bloquea: Supabase Auth limita por IP igual.
 */
export async function signInWithGuard(
  supabase: SupabaseClient,
  credentials: { email: string; password: string },
  ip: string,
) {
  const admin = createAdminClient();
  const { data: wait } = await admin.rpc("login_wait_seconds", { p_email: credentials.email, p_ip: ip });
  if (typeof wait === "number" && wait > 0) return { blocked: tooManyAttemptsMessage(wait) } as const;

  const result = await supabase.auth.signInWithPassword(credentials);
  // email_not_confirmed solo llega con la contraseña correcta.
  const correct = !result.error || result.error.code === "email_not_confirmed";
  await admin.rpc("record_login_attempt", { p_email: credentials.email, p_ip: ip, p_success: correct });
  return { result } as const;
}
