import { NextResponse, type NextRequest } from "next/server";
import { destinationFor } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

/** Retorno de Google OAuth, confirmación de correo y recuperación de clave. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  let next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  // Tras el primer login con Google faltan teléfono y ubicación.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, department_id, is_active, role")
    .eq("id", user!.id)
    .single();
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=inactive", origin));
  }
  if (profile && !next.startsWith("/actualizar-clave")) next = destinationFor(profile.role, next);
  if (
    (!profile?.phone || !profile?.department_id) &&
    !next.startsWith("/completar-perfil") &&
    !next.startsWith("/actualizar-clave")
  ) {
    return NextResponse.redirect(
      new URL(`/completar-perfil?next=${encodeURIComponent(next)}`, origin),
    );
  }
  return NextResponse.redirect(new URL(next, origin));
}
