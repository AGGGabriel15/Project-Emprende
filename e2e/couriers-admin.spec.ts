import { expect, test } from "@playwright/test";
import { admin, closePages, login, toast } from "./helpers";

test.afterEach(({ browser }) => closePages(browser));

/** La administración crea un repartidor; al entrar, va directo a su panel y no puede comprar. */
test.describe("alta de repartidores", () => {
  test.skip(({ isMobile }) => isMobile, "Se valida en escritorio.");
  const email = `repartidor.e2e.${Date.now()}@catarina.local`;
  const password = "Temporal2026!";

  test.afterAll(async () => {
    const sb = admin();
    const { data } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
    if (data) await sb.auth.admin.deleteUser(data.id);
  });

  test("el admin crea la cuenta y el repartidor entra a su panel", async ({ browser }) => {
    test.setTimeout(120_000);
    const boss = await browser.newPage();
    await login(boss, "admin@catarina.local", "/admin/repartidores");
    await boss.waitForURL((u) => u.pathname.startsWith("/admin"));
    await boss.goto("/admin/repartidores");
    await boss.getByRole("button", { name: "Nuevo repartidor" }).click();
    const dialog = boss.getByRole("dialog");
    await dialog.getByLabel("Nombre completo").fill("Pedro Prueba E2E");
    await dialog.getByLabel("Correo").fill(email);
    await dialog.getByRole("textbox", { name: "Teléfono" }).fill("88887777");
    await dialog.getByLabel("Placa").fill("M 999-111");
    await dialog.getByLabel("Contraseña temporal").fill(password);
    await dialog.getByRole("button", { name: "Crear repartidor" }).click();
    await toast(boss, "Repartidor creado");
    await expect(boss.locator(`[data-courier="${email}"]`)).toContainText("Fuera de turno");

    const rider = await browser.newPage();
    await rider.goto("/login");
    await rider.getByLabel("Correo").fill(email);
    await rider.getByLabel("Contraseña", { exact: false }).first().fill(password);
    await rider.getByRole("button", { name: "Entrar", exact: true }).click();
    await rider.waitForURL((u) => u.pathname === "/repartidor");
    await expect(rider.getByText("Hola, Pedro")).toBeVisible();
    await expect(rider.getByText("Ponte en turno para ver pedidos")).toBeVisible();

    // No puede comprar: el carrito lo devuelve a su panel.
    await rider.goto("/carrito");
    await rider.waitForURL((u) => u.pathname === "/repartidor");
  });
});
