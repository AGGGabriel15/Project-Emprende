"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl, failure, invalid, success } from "@/lib/actions";
import { destinationFor, needsProfileCompletion } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  emailSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetSchema,
} from "@/lib/validations/auth";
import { emailStatus, emailTakenMessage } from "./email-status";
import { clientIp, signInWithGuard } from "./login-guard";

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? appUrl();
}

/** A dónde lleva el enlace del correo de confirmación. */
async function confirmRedirect(next?: string) {
  return `${await origin()}/auth/callback?next=${encodeURIComponent(
    `/completar-perfil?next=${encodeURIComponent(safeNext(next))}`,
  )}`;
}

export async function signIn(input: unknown, next?: string) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const attempt = await signInWithGuard(supabase, parsed.data, clientIp(await headers()));
  if ("blocked" in attempt) return failure({ message: attempt.blocked });
  const { error } = attempt.result;
  if (error) {
    return failure(
      error.code === "email_not_confirmed"
        ? { message: "Confirma tu correo antes de entrar." }
        : { message: "Correo o contraseña incorrectos." },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, phone, department_id, role")
    .eq("id", user!.id)
    .single();
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return failure({ message: "Tu cuenta está desactivada. Contacta a soporte." });
  }
  const destination = destinationFor(profile?.role ?? "customer", safeNext(next));
  if (!profile || needsProfileCompletion(profile)) {
    return success({ redirectTo: `/completar-perfil?next=${encodeURIComponent(destination)}` });
  }
  return success({ redirectTo: destination });
}

export async function signUp(input: unknown, next?: string) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createClient();
  const emailRedirectTo = await confirmRedirect(next);

  const existing = await emailStatus(email);
  const taken = emailTakenMessage(existing);
  if (taken) return failure({ message: taken });
  if (existing.status === "unconfirmed") {
    // Ya se registró pero no confirmó: se le reenvía el enlace.
    await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
    return success({ redirectTo: null, needsConfirmation: true });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, accepted_terms: true }, emailRedirectTo },
  });
  if (error) {
    return failure(
      error.code === "user_already_exists"
        ? { message: "Este correo ya tiene una cuenta. Entra o recupera tu contraseña." }
        : error,
    );
  }
  // Supabase disimula el registro repetido devolviendo un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return failure({ message: "Este correo ya tiene una cuenta. Entra o recupera tu contraseña." });
  }
  // Si el proyecto no exige confirmar el correo, la sesión ya está activa.
  if (data.session) {
    return success({
      redirectTo: `/completar-perfil?next=${encodeURIComponent(safeNext(next))}`,
      needsConfirmation: false,
    });
  }
  return success({ redirectTo: null, needsConfirmation: true });
}

/** Estado del correo mientras se escribe en el registro (disponible, registrado o sin confirmar). */
export async function checkEmail(email: unknown) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return success({ status: "invalid" as const, message: null });
  const status = await emailStatus(parsed.data);
  return success({ status: status.status, message: emailTakenMessage(status) });
}

/** Vuelve a enviar el correo de confirmación. Supabase permite uno por minuto. */
export async function resendConfirmation(email: unknown, next?: string) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: await confirmRedirect(next) },
  });
  if (error) {
    return failure({
      message: error.status === 429 ? "Espera un minuto antes de pedir otro correo." : "No pudimos reenviar el correo. Intenta de nuevo.",
    });
  }
  return success();
}

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error || !data.url) return failure(error, "No pudimos conectar con Google.");
  redirect(data.url);
}

export async function requestPasswordReset(input: unknown) {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/actualizar-clave`,
  });
  // Misma respuesta exista o no la cuenta.
  return success();
}

export async function updatePassword(input: unknown) {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(error, "No pudimos actualizar la contraseña.");
  return success();
}

/**
 * Token de acceso corto (1 h) para el cliente de Supabase del navegador
 * (Realtime y subidas). Las cookies de sesión son HttpOnly: el refresh token
 * nunca llega al JavaScript de la página.
 */
export async function browserSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return { accessToken: session.access_token, userId: user.id, expiresAt: (session.expires_at ?? 0) * 1000 };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
