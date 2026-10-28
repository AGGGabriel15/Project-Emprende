"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl, failure, invalid, success } from "@/lib/actions";
import { destinationFor } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetSchema,
} from "@/lib/validations/auth";

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? appUrl();
}

export async function signIn(input: unknown, next?: string) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
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
  if (!profile?.phone || !profile?.department_id) {
    return success({ redirectTo: `/completar-perfil?next=${encodeURIComponent(destination)}` });
  }
  return success({ redirectTo: destination });
}

export async function signUp(input: unknown, next?: string) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, accepted_terms: true },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(
        `/completar-perfil?next=${encodeURIComponent(safeNext(next))}`,
      )}`,
    },
  });
  if (error) {
    return failure(
      error.code === "user_already_exists"
        ? { message: "Ya existe una cuenta con ese correo." }
        : error,
    );
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
