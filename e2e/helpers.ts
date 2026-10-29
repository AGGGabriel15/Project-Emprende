import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables ya presentes en el entorno (CI).
}

export const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Catarina2026!";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

/** Cliente de Supabase con la sesión de un usuario (para llamar RPC como él). */
export async function userClient(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export async function login(page: Page, email: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Foto de prueba (PNG 1×1) para los campos de evidencia. */
export const PHOTO = {
  name: "foto.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
};

export async function pinFor(orderId: string) {
  const { data } = await admin().from("order_secrets").select("pin").eq("order_id", orderId).single();
  return data!.pin as string;
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Cierra las pestañas abiertas con browser.newPage(): el navegador vive todo el
 * worker y, con Realtime activo, una pestaña olvidada se refresca con cada evento.
 */
export async function closePages(browser: Browser) {
  await Promise.all(browser.contexts().map((context) => context.close()));
}
