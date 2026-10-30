import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { businessOpenState, type BusinessWithMeta } from "@/features/catalog/meta";
import { getPlatformZones } from "@/features/catalog/queries";
import { removeOrderedFromCart } from "@/features/orders/server";
import { getPaymentProvider } from "@/features/payments/provider";
import { openStripeCheckoutUrl, syncStripePayment } from "@/features/payments/sync";
import { appUrl, failure, invalid, success } from "@/lib/actions";
import { canShop } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { cartLineSchema, checkoutSchema } from "@/lib/validations/checkout";
import type { Address, Order, OrderItem, Product, ServiceType } from "@/types/domain";
import { zoneFor } from "./pricing";
import type { Quote, QuoteLine } from "./types";

export type { Quote, QuoteLine };

/**
 * Lógica del checkout compartida por las Server Actions (sesión por cookies)
 * y la API de la app móvil (sesión por token). Recibe el cliente de Supabase
 * del usuario, así RLS aplica igual en ambos casos.
 */

type CheckoutUser = Pick<User, "id" | "email">;

/** A dónde vuelve Stripe al pagar o cancelar. */
export type ReturnUrls = (orderId: string) => { successUrl: string; cancelUrl: string };

export const webReturnUrls: ReturnUrls = (orderId) => ({
  successUrl: `${appUrl()}/checkout/exito?pedido=${orderId}`,
  cancelUrl: `${appUrl()}/checkout/cancelado?pedido=${orderId}`,
});

/** La app móvil vuelve por /api/mobile/return, que reabre la app (`app`) en el pedido. */
export const mobileReturnUrls =
  (app: string): ReturnUrls =>
  (orderId) => {
    const back = (estado: string) => `${appUrl()}/api/mobile/return?pedido=${orderId}&estado=${estado}&app=${encodeURIComponent(app)}`;
    return { successUrl: back("exito"), cancelUrl: back("cancelado") };
  };

const quoteSchema = z.object({
  businessId: z.string().uuid(),
  serviceType: z.enum(["delivery", "pickup"]),
  addressId: z.string().uuid().optional(),
  items: z.array(cartLineSchema).max(50),
});

/**
 * Vista previa del pedido con los datos actuales de la base (precio, stock,
 * horario, cobertura). Es lo mismo que validará create_order() al pagar.
 */
export async function quoteWith(supabase: SupabaseClient, input: unknown, clientPrices?: Record<string, number>) {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessId, serviceType, addressId, items } = parsed.data;

  const [{ data: business }, { data: products }, address] = await Promise.all([
    supabase
      .from("businesses")
      .select("*, category:platform_categories(name, slug, icon), business_hours(*), business_closures(date, reason)")
      .eq("id", businessId)
      .maybeSingle(),
    supabase.from("products").select("*").eq("business_id", businessId).in("id", items.map((i) => i.productId)),
    addressId
      ? supabase.from("addresses").select("*").eq("id", addressId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!business || business.status !== "approved") {
    return failure({ message: "Este negocio no está disponible." });
  }
  const meta = business as BusinessWithMeta;
  const byId = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const issues: string[] = [];

  const lines: QuoteLine[] = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.is_active) {
      return { productId: item.productId, name: "Producto no disponible", unitPrice: 0, quantity: item.quantity, stock: 0, available: false, priceChanged: false, issue: "Ya no está disponible" };
    }
    const priceChanged = clientPrices?.[product.id] !== undefined && clientPrices[product.id] !== product.price_minor;
    const issue =
      product.stock <= 0
        ? "Agotado"
        : product.stock < item.quantity
          ? `Solo quedan ${product.stock}`
          : undefined;
    return {
      productId: product.id,
      name: product.name,
      image: product.images[0],
      unitPrice: product.price_minor,
      quantity: item.quantity,
      stock: product.stock,
      available: !issue,
      priceChanged,
      issue,
    };
  });
  if (lines.some((l) => !l.available)) issues.push("Hay productos agotados o sin existencias suficientes.");
  if (lines.some((l) => l.priceChanged)) issues.push("Algunos precios cambiaron desde que los agregaste.");

  const state = businessOpenState(meta);
  if (!state.open) issues.push(`El negocio está cerrado${state.detail ? ` · ${state.detail.toLowerCase().replace(/\.$/, "")}` : ""}.`);

  let deliveryFee = 0;
  let estimatedDays: number | null = null;
  let canDeliver = false;
  const addr = address.data as Address | null;
  const [zones, { data: serviceSetting }] = await Promise.all([
    getPlatformZones(),
    supabase.from("platform_settings").select("value").eq("key", "service_fee_minor").maybeSingle(),
  ]);
  const serviceFee = Number(serviceSetting?.value ?? 1500);
  if (addr) {
    const zone = zoneFor(zones, addr.department_id, addr.municipality_id);
    canDeliver = Boolean(zone);
    if (zone && serviceType === "delivery") {
      deliveryFee = zone.fee_minor;
      estimatedDays = zone.estimated_days;
    }
  }
  if (serviceType === "delivery" && addr && !canDeliver) {
    issues.push(meta.accepts_pickup ? "Aún no entregamos en esa dirección. Elige retiro en el negocio u otra dirección." : "Aún no entregamos en esa dirección.");
  }

  const subtotal = lines.filter((l) => l.available).reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  return success<Quote>({
    lines,
    subtotal,
    deliveryFee,
    serviceFee,
    estimatedDays,
    total: subtotal + deliveryFee + serviceFee,
    open: state.open,
    openDetail: state.detail,
    canDeliver,
    issues,
  });
}

async function startCheckout(
  order: Order & { items: OrderItem[]; business: { trade_name: string } },
  email: string | undefined,
  urls: ReturnUrls,
) {
  const provider = await getPaymentProvider();
  const session = await provider.createCheckout({
    orderId: order.id,
    orderNumber: order.order_number,
    businessName: order.business.trade_name,
    items: order.items.map((item) => ({
      name: item.product_name,
      unitPriceMinor: item.unit_price_minor,
      quantity: item.quantity,
    })),
    deliveryFeeMinor: order.delivery_fee_minor,
    serviceFeeMinor: order.service_fee_minor,
    customerEmail: email,
    ...urls(order.id),
  });
  await createAdminClient()
    .from("orders")
    .update({ payment_provider: provider.name, stripe_session_id: session.sessionId })
    .eq("id", order.id);
  return session.url;
}

/** Crea el pedido (create_order valida todo en una transacción) y abre el pago. */
export async function placeOrderWith(supabase: SupabaseClient, user: CheckoutUser | null, input: unknown, urls: ReturnUrls = webReturnUrls) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  if (!user) return failure({ message: "Inicia sesión para pagar." });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canShop(me?.role)) {
    return failure({ message: "Las cuentas de vendedor o administrador no pueden comprar." });
  }

  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_business: data.businessId,
    p_service: data.serviceType as ServiceType,
    p_address: data.serviceType === "delivery" ? data.addressId : null,
    p_items: data.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      note: item.note ?? null,
    })),
    p_contact_name: data.contactName,
    p_contact_phone: data.contactPhone,
    p_note: data.note ?? null,
  });
  if (error) return failure(error, "No pudimos crear el pedido.");
  // El pedido ya existe (pestaña Pendientes): sus productos salen del carrito guardado.
  await removeOrderedFromCart(orderId as string);

  const { data: order } = await supabase
    .from("orders")
    .select("*, items:order_items(*), business:businesses(trade_name)")
    .eq("id", orderId)
    .single();
  try {
    const url = await startCheckout(order, user.email, urls);
    return success({ orderId: orderId as string, url });
  } catch (err) {
    console.error("[checkout]", err);
    return failure({ message: "El pedido se creó pero no pudimos abrir el pago. Reintenta desde Mis pedidos." });
  }
}

/** Reabre el pago de un pedido pendiente (pestaña Pendientes). */
export async function resumePaymentWith(supabase: SupabaseClient, user: CheckoutUser | null, orderId: string, urls: ReturnUrls = webReturnUrls) {
  const { data: order } = await supabase
    .from("orders")
    .select("*, items:order_items(*), business:businesses(trade_name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!user || !order || order.customer_id !== user.id) return failure({ message: "Pedido no encontrado." });
  if (order.status !== "pending_payment" || new Date(order.expires_at) < new Date()) {
    return failure({ message: "Este pedido ya no está pendiente de pago." });
  }
  // Si ya se pagó en Stripe (webhook pendiente), se acredita en vez de cobrar otra vez;
  // si la sesión anterior sigue abierta, se reutiliza.
  const synced = await syncStripePayment(order.id);
  if (synced === "confirmed" || synced === "already") {
    return success({ url: urls(order.id).successUrl });
  }
  if (synced) return failure({ message: "Este pedido ya no está pendiente de pago." });
  try {
    const openUrl = await openStripeCheckoutUrl(order.id);
    return success({ url: openUrl ?? (await startCheckout(order, user.email, urls)) });
  } catch (err) {
    return failure(err, "No pudimos abrir el pago.");
  }
}
