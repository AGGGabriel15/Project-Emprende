import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, signInWithGuard } from "@/features/auth/login-guard";
import { jsonBody } from "@/lib/mobile-api";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Inicio de sesión con contraseña de la app, con el mismo límite de intentos
 * que el web. Devuelve los tokens y la app los guarda con setSession.
 */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ingresa tu correo y contraseña." });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const attempt = await signInWithGuard(supabase, parsed.data, clientIp(request.headers));
  if ("blocked" in attempt) return NextResponse.json({ ok: false, error: attempt.blocked }, { status: 429 });

  const { data, error } = attempt.result;
  if (error || !data.session) {
    return NextResponse.json({
      ok: false,
      error: error?.code === "email_not_confirmed" ? "Confirma tu correo antes de entrar." : "Correo o contraseña incorrectos.",
    });
  }
  return NextResponse.json({
    ok: true,
    data: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  });
}
