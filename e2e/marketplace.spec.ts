import { expect, test } from "@playwright/test";

test("muestra el catálogo y sus categorías", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Lo nuestro encuentra/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Explorar productos/i }).click();
  await expect(
    page.getByRole("heading", { name: /Encuentra algo hecho/i }),
  ).toBeVisible();
});

test("cliente completa el pago local de demostración", async ({ page }) => {
  await page.goto("/productos");
  await page
    .getByRole("button", { name: /Agregar .* al carrito/i })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: /Carrito, 1 art/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Carrito, 1 art/i }).click();
  await page.getByRole("link", { name: /Continuar al pago/i }).click();
  await page.getByLabel("Correo electrónico").fill("cliente@catarina.local");
  await page
    .getByLabel("Contraseña")
    .fill(process.env.SEED_DEFAULT_PASSWORD ?? "Demo12345!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByLabel("Nombre de quien recibe").fill("Carlos Cliente");
  await page.getByLabel("Teléfono").fill("88882001");
  await page.getByRole("button", { name: "Ir a pagar" }).click();
  await page.getByRole("button", { name: /Confirmar pago de prueba/i }).click();
  await expect(
    page.getByRole("heading", { name: /Pedido confirmado/i }),
  ).toBeVisible();
});

test("protege el panel administrativo", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
