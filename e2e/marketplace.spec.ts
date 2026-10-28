import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables ya presentes en el entorno (CI).
}

/**
 * Flujo de compra de punta a punta en modo de pago simulado.
 * Requiere: migraciones + seed + `npm run seed:demo` y PAYMENTS_MODE=mock.
 */
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Catarina2026!";

async function chooseLocation(page: Page) {
  const dialog = page.getByRole("dialog", { name: "¿Dónde estás?" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Departamento").selectOption({ label: "Masaya" });
  await dialog.getByLabel("Ciudad / municipio").selectOption({ label: "Catarina" });
  await dialog.getByRole("button", { name: "Guardar ubicación" }).click();
  await expect(dialog).toBeHidden();
}

async function login(page: Page, email: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: false }).first().fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("compra multi-negocio", () => {
  test.skip(({ isMobile }) => isMobile, "El flujo completo se valida en escritorio.");

  // La prueba no debe depender de la hora: abre el vivero mientras corre.
  const admin = () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  test.beforeAll(async () => {
    await admin().from("businesses").update({ is_open_override: true }).eq("slug", "vivero-los-helechos");
  });
  test.afterAll(async () => {
    await admin().from("businesses").update({ is_open_override: null }).eq("slug", "vivero-los-helechos");
  });

  test("cliente compra a un negocio y el vendedor lo completa", async ({ browser }) => {
    test.setTimeout(300_000);
    const customer = await browser.newPage();
    await customer.goto("/");
    await chooseLocation(customer);

    // Productos de dos negocios distintos en el mismo carrito.
    await customer.goto("/negocios/vivero-los-helechos");
    await customer.getByRole("button", { name: /Agregar Trío de suculentas/ }).click();
    await customer.goto("/negocios/artesanias-el-mirador");
    await customer.getByRole("button", { name: /Agregar Alcancía de cerdito/ }).click();

    await customer.goto("/carrito");
    await expect(customer.getByText("de 2 negocios")).toBeVisible();

    await login(customer, "cliente@catarina.local", "/carrito");
    await customer.goto("/carrito");
    // Los grupos siguen el orden en que se agregaron: primero el vivero.
    await customer.getByRole("link", { name: "Pagar este pedido" }).first().click();
    await customer.waitForURL(/\/checkout\//, { timeout: 60_000 });
    await expect(customer.getByRole("heading", { name: /Vivero Los Helechos/ })).toBeVisible({ timeout: 30_000 });

    await customer.getByRole("radio", { name: /Para llevar/ }).click();
    await customer.getByRole("button", { name: /^Pagar C\$/ }).click();
    await customer.waitForURL(/pago-demo/, { timeout: 60_000 });
    await customer.getByRole("button", { name: /^Pagar C\$/ }).click(); // pasarela demo
    await expect(customer.getByRole("heading", { name: "¡Pago confirmado!" })).toBeVisible({ timeout: 60_000 });

    // El otro negocio sigue en el carrito.
    await customer.goto("/carrito");
    await expect(customer.getByText("Artesanías El Mirador")).toBeVisible();

    // El vendedor avanza el pedido.
    const vendor = await browser.newPage();
    await login(vendor, "maria@catarina.local", "/vendedor/pedidos");
    await vendor.goto("/vendedor/pedidos");
    await vendor.getByRole("button", { name: "Marcar listo para retirar" }).first().click();
    await vendor.getByRole("button", { name: "Entregado al cliente" }).first().click();

    await customer.goto("/pedidos?tab=historial");
    await expect(customer.getByText("Completado").first()).toBeVisible();
  });
});

test("visitante explora sin cuenta y el checkout pide login", async ({ page }) => {
  await page.goto("/");
  await chooseLocation(page);
  await expect(page.getByRole("heading", { name: /Artesanías, plantas y flores/ })).toBeVisible();
  await page.goto("/checkout/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("cuentas de vendedor y administración", () => {
  test.skip(({ isMobile }) => isMobile, "Se valida en escritorio.");

  test("el vendedor entra a su panel y no puede comprar", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, "maria@catarina.local", "/");
    await expect(page).toHaveURL(/\/vendedor\/panel/);

    // Menú de cuenta en el panel con acceso al perfil.
    await page.getByRole("button", { name: "Menú de cuenta" }).click();
    await page.getByRole("menuitem", { name: /Mi perfil/ }).click();
    await expect(page).toHaveURL(/\/vendedor\/perfil/);

    // Teléfono con +505 automático y cédula con guiones.
    await expect(page.getByLabel("País del teléfono")).toHaveValue("NI");
    await expect(page.locator("#phone")).toHaveValue("8888 2001");
    await page.locator("#cedula").fill("");
    await page.locator("#cedula").pressSequentially("0011203071017x");
    await expect(page.locator("#cedula")).toHaveValue("001-120307-1017X");

    await page.goto("/negocios/vivero-los-helechos");
    await expect(page.getByRole("button", { name: /Agregar Trío de suculentas/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Mi panel/ })).toBeVisible();
    await page.goto("/carrito");
    await expect(page).toHaveURL(/\/vendedor\/panel/);
  });

  test("el administrador entra a su panel", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "admin@catarina.local", "/");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole("button", { name: "Menú de cuenta" })).toBeVisible();
  });
});
