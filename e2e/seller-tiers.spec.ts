import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { closePages } from "./helpers";

test.afterEach(({ browser }) => closePages(browser));

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables ya presentes en el entorno (CI).
}
const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PNG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`;

/** Emprendedor sin RUC: solicitud con cédula, selfie, fotos y GPS; el admin exige la visita antes de aprobar. */
test("emprendedor informal: solicitud, visita y aprobación", async ({ browser, isMobile }) => {
  test.skip(isMobile);
  test.setTimeout(240_000);
  const email = `informal.e2e.${Date.now()}@catarina.local`;
  const password = "Catarina2026!";
  const sb = admin();
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Rosa Mendoza" },
  });
  if (error) throw error;
  const userId = created.user.id;
  await sb.from("profiles").update({ phone: "+50588887777", department_id: 11, municipality_id: 84 }).eq("id", userId);

  try {
    const context = await browser.newContext({ permissions: ["geolocation"], geolocation: { latitude: 11.9112, longitude: -86.0751 } });
    const page = await context.newPage();
    await page.goto("/login?next=/vendedor/solicitud");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/vendedor\/solicitud/);
    await page.waitForLoadState("networkidle");

    // 1. Nivel informal (sin RUC).
    await expect(page.getByText("Emprendedor verificado")).toBeVisible();
    await expect(page.locator("#ruc")).toHaveCount(0);
    await page.getByLabel("Nombre del negocio").fill("Vivero de Rosa E2E");
    await page.getByRole("button", { name: /Guardar y seguir/ }).click();

    // 2. Documentos del informal.
    await expect(page.getByText("Selfie sosteniendo tu cédula")).toBeVisible({ timeout: 30_000 });
    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await inputs.nth(i).setInputFiles({ name: `doc${i}.png`, mimeType: "image/png", buffer: await svgToPng(page, PNG("#3a7")) });
      await expect(page.getByText("Recibido · toca para reemplazar")).toHaveCount(i + 1, { timeout: 30_000 });
    }
    await page.getByRole("button", { name: /Guardar y seguir/ }).click();

    // 3. Local con ubicación GPS.

    await page.getByLabel("Categoría principal").selectOption({ index: 1 }, { timeout: 10_000 });
    await page.getByLabel("Descripción").fill("Vivero familiar en el patio de mi casa: helechos, suculentas y macetas de barro.");
    await page.getByLabel("Ciudad / municipio").selectOption({ label: "Catarina" });
    await page.getByLabel("Dirección y punto de referencia").fill("Del parque 2 c. al sur, casa con portón verde");
    await page.locator("#phone").fill("88887777");
    await page.getByRole("button", { name: "Usar mi ubicación actual" }).click();
    await expect(page.getByText("11.9112, -86.0751")).toBeVisible();
    await page.getByRole("button", { name: /Guardar y seguir/ }).click();

    // 4. Cuenta a su nombre.
    await page.getByLabel("Banco").selectOption("BANPRO");
    await page.getByLabel("Número de cuenta").fill("100200300");
    await page.getByRole("button", { name: /Guardar y seguir/ }).click();

    // 5. Declaración jurada y envío.
    await expect(page.getByText("Declaración jurada:")).toBeVisible();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("Tu solicitud está en revisión")).toBeVisible({ timeout: 30_000 });

    // Admin: sin visita no se puede aprobar.
    const adminPage = await browser.newPage();
    adminPage.on("dialog", (dialog) => void dialog.accept());
    await adminPage.goto("/login?next=/admin/solicitudes");
    await adminPage.getByLabel("Correo").fill("admin@catarina.local");
    await adminPage.getByLabel("Contraseña", { exact: false }).first().fill(password);
    await adminPage.getByRole("button", { name: "Entrar", exact: true }).click();
    await adminPage.waitForURL((u) => u.pathname.startsWith("/admin"));
    await adminPage.goto("/admin/solicitudes");
    await expect(adminPage.getByText("Falta visita").first()).toBeVisible();
    await adminPage.getByRole("link", { name: /Vivero de Rosa E2E/ }).click();
    await adminPage.waitForURL(/admin\/solicitudes\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(adminPage.getByRole("heading", { name: "Visita de verificación" })).toBeVisible({ timeout: 60_000 });
    await expect(adminPage.getByRole("button", { name: "Aprobar", exact: true })).toBeDisabled();
    await expect(adminPage.getByRole("link", { name: /Ver ubicación exacta/ })).toBeVisible();
    await adminPage.getByRole("button", { name: /Registrar visita realizada/ }).click();
    await adminPage.getByRole("dialog").getByRole("textbox").fill("Patio con vivero, 50 plantas, coincide con fotos. Rosa mostró su cédula.");
    await adminPage.getByRole("dialog").getByRole("button", { name: "Registrar visita" }).click();
    await expect(adminPage.getByText(/Visitado el/)).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole("button", { name: "Aprobar", exact: true }).click();
    await expect(adminPage.getByText("Aprobado").first()).toBeVisible({ timeout: 30_000 });

    // Vendedor: ve su nivel y límites.
    await page.goto("/vendedor/panel");
    await expect(page.getByText("0 de 5 pedidos en curso")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Subir mis límites/ })).toBeVisible();
    await context.close();
  } finally {
    // Limpieza: documentos, negocio y usuario de prueba.
    const { data: biz } = await sb.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
    const { data: files } = await sb.storage.from("business-documents").list(`${userId}/docs`);
    if (files?.length) await sb.storage.from("business-documents").remove(files.map((f) => `${userId}/docs/${f.name}`));
    if (biz) await sb.from("businesses").delete().eq("id", biz.id);
    await sb.from("audit_logs").delete().eq("entity_id", biz?.id ?? "-");
    await sb.auth.admin.deleteUser(userId);
  }
});

async function svgToPng(page: import("@playwright/test").Page, svg: string) {
  const base64 = await page.evaluate(async (markup) => {
    const img = new Image();
    img.src = `data:image/svg+xml,${encodeURIComponent(markup)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 64, 64);
    return canvas.toDataURL("image/png").split(",")[1];
  }, svg);
  return Buffer.from(base64, "base64");
}
