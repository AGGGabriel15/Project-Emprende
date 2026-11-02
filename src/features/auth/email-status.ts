import { createAdminClient } from "@/lib/supabase/admin";

export type EmailStatus =
  | { status: "available" }
  | { status: "registered"; provider: "email" | "google" }
  | { status: "unconfirmed" };

/**
 * ¿Ya hay una cuenta con este correo? Supabase responde "éxito" a un registro
 * repetido (para no revelar cuentas), así que el registro lo consulta antes.
 * Lo usan el formulario web (en vivo y al enviar) y la app (/api/mobile/email-status).
 */
export async function emailStatus(email: string): Promise<EmailStatus> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!profile) return { status: "available" };
  const { data } = await admin.auth.admin.getUserById(profile.id);
  const user = data.user;
  if (!user) return { status: "available" };
  const providers = new Set((user.identities ?? []).map((identity) => identity.provider));
  if (!user.email_confirmed_at && providers.has("email")) return { status: "unconfirmed" };
  return { status: "registered", provider: providers.has("email") ? "email" : "google" };
}

export function emailTakenMessage(status: EmailStatus) {
  if (status.status !== "registered") return null;
  return status.provider === "google"
    ? "Este correo ya tiene una cuenta con Google. Entra con «Continuar con Google»."
    : "Este correo ya tiene una cuenta. Entra o recupera tu contraseña.";
}
