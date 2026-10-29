import { expect, test } from "@playwright/test";
import { admin, closePages, login, PHOTO, pinFor, toast, userClient } from "./helpers";

test.afterEach(({ browser }) => closePages(browser));

/**
 * Delivery con repartidores propios, de punta a punta y con evidencia:
 * foto del negocio → el repartidor en turno acepta → llega y recoge con foto →
 * ve los datos del cliente → "llegué" → entrega con PIN → el cliente lo califica
 * y reclama con foto → reembolso parcial a cargo del negocio.
 * El pedido se crea y paga por RPC para no depender de la pasarela.
 */
const GEO = { geolocation: { latitude: 11.912, longitude: -86.074 }, permissions: ["geolocation"] };

test.describe("delivery con repartidor", () => {
  test.skip(({ isMobile }) => isMobile, "Se valida en escritorio.");
  let orderId = "";
  let orderNumber = "";
  let addressId = "";
  let vivero = "";
  let rider = "";

  test.beforeAll(async () => {
    const sb = admin();
    vivero = (await sb.from("businesses").select("id").eq("slug", "vivero-los-helechos").single()).data!.id;
    rider = (await sb.from("profiles").select("id").eq("email", "repartidor@catarina.local").single()).data!.id;
    await sb.from("businesses").update({ is_open_override: true, status: "approved" }).eq("id", vivero);
    await sb.from("couriers").update({ is_online: false }).eq("profile_id", rider);
    const customer = await userClient("cliente@catarina.local");
    const { data: user } = await customer.auth.getUser();
    const { data: address } = await customer
      .from("addresses")
      .insert({ user_id: user.user!.id, label: "E2E", department_id: 11, municipality_id: 87, address_line: "Del parque 1 c. al norte (E2E)", recipient_name: "Carlos", phone: "+50588881000" })
      .select("id")
      .single();
    addressId = address!.id;
    const { data: product } = await sb.from("products").select("id").eq("business_id", vivero).eq("is_active", true).eq("review_status", "approved").gt("stock", 0).limit(1).single();
    const { data: id, error } = await customer.rpc("create_order", {
      p_business: vivero,
      p_service: "delivery",
      p_address: addressId,
      p_items: [{ product_id: product!.id, quantity: 1 }],
      p_contact_name: "Carlos",
      p_contact_phone: "+50588881000",
    });
    if (error) throw error;
    orderId = id as string;
    const { data: order } = await sb.from("orders").select("order_number, total_minor").eq("id", orderId).single();
    orderNumber = order!.order_number;
    await sb.rpc("confirm_order_payment", { p_order: orderId, p_provider: "mock", p_ref: "mock_pi_e2e", p_amount: order!.total_minor });
  });

  test.afterAll(async () => {
    const sb = admin();
    await sb.from("businesses").update({ is_open_override: null }).eq("id", vivero);
    if (!orderId) return;
    const { data: items } = await sb.from("order_items").select("product_id, quantity").eq("order_id", orderId);
    for (const item of items ?? []) {
      const { data: p } = await sb.from("products").select("stock").eq("id", item.product_id).single();
      if (p) await sb.from("products").update({ stock: p.stock + item.quantity }).eq("id", item.product_id);
    }
    await sb.from("strikes").delete().eq("order_id", orderId);
    await sb.from("ledger_entries").delete().eq("order_id", orderId);
    await sb.from("orders").delete().eq("id", orderId);
    if (addressId) await sb.from("addresses").delete().eq("id", addressId);
    // La calificación de prueba se borra con el pedido: recalcula el promedio del repartidor.
    const { data: ratings } = await sb.from("delivery_ratings").select("rating").eq("courier_id", rider);
    const list = ratings ?? [];
    await sb
      .from("couriers")
      .update({
        is_online: false,
        rating_count: list.length,
        rating_avg: list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : 0,
      })
      .eq("profile_id", rider);
  });

  test("del empaque a la calificación, con evidencia en cada paso", async ({ browser }) => {
    test.setTimeout(480_000);

    // 1. El negocio marca listo con foto: queda buscando repartidor.
    const vendor = await browser.newPage();
    await login(vendor, "maria@catarina.local", "/vendedor/pedidos");
    await vendor.goto("/vendedor/pedidos");
    const card = vendor.locator(`[data-order="${orderNumber}"]`);
    await card.getByRole("button", { name: /Marcar listo/ }).click();
    await vendor.getByLabel("Foto del pedido empacado").setInputFiles(PHOTO);
    await vendor.getByRole("button", { name: /Confirmar listo/ }).click();
    await toast(vendor, "listo");
    await expect(card.getByText("Buscando repartidor")).toBeVisible({ timeout: 30_000 });

    // 2. El repartidor se pone en turno y acepta el pedido disponible.
    const courier = await browser.newPage(GEO);
    await login(courier, "repartidor@catarina.local", "/repartidor");
    await courier.waitForURL((u) => u.pathname.startsWith("/repartidor"));
    await courier.getByRole("switch", { name: "En turno" }).click();
    await toast(courier, "Estás en turno");
    const offer = courier.locator(`[data-available="${orderNumber}"]`);
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).not.toContainText("88881000");
    await offer.getByRole("button", { name: "Aceptar" }).click();
    await courier.waitForURL(/\/repartidor\/entrega\//);

    // Ve al cliente: nombre, dirección y teléfono para llamarlo.
    await expect(courier.getByText("2 · Entregar a Carlos")).toBeVisible();
    await expect(courier.getByText(/Del parque 1 c\. al norte \(E2E\)/)).toBeVisible();
    await expect(courier.getByRole("link", { name: /Llamar · \+505 8888 1000/ })).toBeVisible();
    await expect(vendor.locator(`[data-order="${orderNumber}"]`).getByText(/Repartidor: Luis Repartidor/)).toBeVisible({ timeout: 30_000 });

    // 3. Llega, recoge con foto y llega donde el cliente.
    await courier.getByRole("button", { name: "Llegué al negocio" }).click();
    await toast(courier, "Le avisamos al negocio");
    await courier.getByRole("button", { name: "Recogí el pedido" }).click();
    await courier.getByRole("dialog").getByLabel("Foto").setInputFiles(PHOTO);
    await courier.getByRole("dialog").getByRole("button", { name: "Recogí el pedido" }).click();
    await courier.getByRole("button", { name: "Llegué donde el cliente" }).click({ timeout: 30_000 });
    await toast(courier, "Le avisamos al cliente");

    // 4. El cliente ve que su repartidor llegó y su PIN.
    const pin = await pinFor(orderId);
    const customer = await browser.newPage();
    await login(customer, "cliente@catarina.local", `/pedidos/${orderId}`);
    await customer.goto(`/pedidos/${orderId}`);
    await expect(customer.getByText("¡Tu repartidor llegó! Este es tu PIN")).toBeVisible();
    await expect(customer.getByText(pin, { exact: true })).toBeVisible();
    await expect(customer.getByTestId("courier-card")).toContainText("Luis Repartidor");

    // 5. Un PIN equivocado no entrega; el correcto sí, sin intervención del negocio.
    await courier.getByRole("button", { name: "Entregar con PIN" }).click();
    const dialog = courier.getByRole("dialog");
    await dialog.getByLabel("Foto").setInputFiles(PHOTO);
    await dialog.getByLabel("PIN del cliente").fill(pin === "0000" ? "1111" : "0000");
    await dialog.getByRole("button", { name: "Entregado" }).click();
    await toast(courier, "PIN incorrecto");
    await dialog.getByLabel("PIN del cliente").fill(pin);
    await dialog.getByRole("button", { name: "Entregado" }).click();
    await expect(courier.getByText("Esta entrega ya terminó")).toBeVisible({ timeout: 30_000 });
    await expect(courier.getByText("Los datos de contacto se ocultan al terminar la entrega.")).toBeVisible();

    // 6. El cliente ve la evidencia y califica al repartidor.
    await customer.reload();
    await expect(customer.getByText("Evidencia del pedido")).toBeVisible();
    await expect(customer.getByText("Recogido por el repartidor")).toBeVisible();
    await customer.getByRole("radio", { name: "5 estrellas para el repartidor" }).click();
    await customer.getByRole("button", { name: "Amable" }).click();
    await customer.getByRole("button", { name: "Calificar entrega" }).click();
    await toast(customer, "Gracias por calificar la entrega");

    // 7. Reclama con foto y la administración aprueba un reembolso parcial a cargo del negocio.
    await customer.getByRole("button", { name: "Reportar un problema" }).click();
    const claim = customer.getByRole("dialog");
    await claim.getByLabel("Cuéntanos los detalles").fill("La maceta llegó quebrada en una esquina.");
    await claim.locator('input[type="file"]').setInputFiles(PHOTO);
    await claim.getByRole("button", { name: "Enviar reclamo" }).click();
    await toast(customer, "Recibimos tu reclamo");
    await expect(customer.getByText(/Llegó dañado · En revisión/)).toBeVisible({ timeout: 30_000 });

    const boss = await browser.newPage();
    await login(boss, "admin@catarina.local", "/admin/reclamos");
    await boss.waitForURL((u) => u.pathname.startsWith("/admin"));
    await boss.goto("/admin/reclamos");
    const claimCard = boss.locator(`[data-claim="${orderNumber}"]`);
    await claimCard.getByLabel(/Reembolso/).fill("50");
    await claimCard.getByLabel(/Decisión/).fill("Las fotos muestran la maceta dañada al empacar.");
    await claimCard.getByRole("button", { name: "Aprobar y reembolsar" }).click();
    await toast(boss, "Reclamo aprobado");

    // 8. La administración ve al repartidor con su calificación.
    await boss.goto("/admin/repartidores");
    await expect(boss.locator('[data-courier="repartidor@catarina.local"]')).toContainText("entregadas");

    const sb = admin();
    const { data: order } = await sb.from("orders").select("status, payment_status, delivery_method").eq("id", orderId).single();
    const { data: shipment } = await sb.from("shipments").select("status, courier_id, delivery_lat").eq("order_id", orderId).single();
    const { data: rating } = await sb.from("delivery_ratings").select("rating, tags").eq("order_id", orderId).single();
    expect(order).toMatchObject({ status: "completed", payment_status: "partially_refunded", delivery_method: "pin" });
    expect(shipment).toMatchObject({ status: "delivered", courier_id: rider });
    expect(shipment!.delivery_lat).not.toBeNull();
    expect(rating).toMatchObject({ rating: 5, tags: ["Amable"] });
  });
});
