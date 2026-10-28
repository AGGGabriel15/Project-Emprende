"use server";

import { z } from "zod";
import { businessOpenState, type BusinessWithMeta } from "@/features/catalog/meta";
import { confirmPayment } from "@/features/orders/server";
import { getPaymentProvider } from "@/features/payments/provider";
import { appUrl, failure, invalid, success } from "@/lib/actions";
import { canShop } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cartLineSchema, checkoutSchema } from "@/lib/validations/checkout";
import type { Address, Order, OrderItem, Product, ServiceType } from "@/types/domain";
import { zoneFor } from "./pricing";

const quoteSchema = z.object({
  businessId: z.string().uuid(),
  serviceType: z.enum(["delivery", "pickup"]),
  addressId: z.string().uuid().optional(),
  items: z.array(cartLineSchema).max(50),
});

export type QuoteLine = {
  productId: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  available: boolean;
  priceChanged: boolean;
  issue?: string;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  deliveryFee: number;
  estimatedDays: number | null;
  total: number;
  open: boolean;
  openDetail?: string;
  canDeliver: boolean;
  issues: string[];
};

/**
 * Vista previa del pedido con los datos actuales de la base (precio, stock,
 * horario, cobertura). Es lo mismo que validará create_order() al pagar.
 */
export async function quoteCheckout(input: unknown, clientPrices?: Record<string, number>) {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessId, serviceType, addressId, items } = parsed.data;
  const supabase = await createClient();

  const [{ data: business }, { data: products }, address] = await Promise.all([
    supabase
      .from("businesses")
      .select("*, category:platform_categories(name, slug, icon), business_hours(*), business_closures(date, reason), delivery_zones(*)")
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
  if (meta.accepts_delivery && addr) {
    const zone = zoneFor(meta.delivery_zones, addr.department_id, addr.municipality_id);
    canDeliver = Boolean(zone);
    if (zone && serviceType === "delivery") {
      deliveryFee = zone.fee_minor;
      estimatedDays = zone.estimated_days;
    }
  }
  if (serviceType === "delivery" && addr && !canDeliver) {
    issues.push("El negocio no envía a esa dirección. Elige Para llevar u otra dirección.");
  }

  const subtotal = lines.filter((l) => l.available).reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  return success<Quote>({
    lines,
    subtotal,
    deliveryFee,
    estimatedDays,
    total: subtotal + deliveryFee,
    open: state.open,
    openDetail: state.detail,
    canDeliver,
    issues,
  });
}

async function startCheckout(order: Order & { items: OrderItem[]; business: { trade_name: string } }, email?: string) {
  const provider = await getPaymentProvider();
  const base = appUrl();
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
    customerEmail: email,
    successUrl: `${base}/checkout/exito?pedido=${order.id}`,
    cancelUrl: `${base}/checkout/cancelado?pedido=${order.id}`,
  });
  await createAdminClient()
    .from("orders")
    .update({ payment_provider: provider.name, stripe_session_id: session.sessionId })
    .eq("id", order.id);
  return session.url;
}

/** Crea el pedido (create_order valida todo en una transacción) y abre el pago. */
export async function placeOrder(input: unknown) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { data: order } = await supabase
    .from("orders")
    .select("*, items:order_items(*), business:businesses(trade_name)")
    .eq("id", orderId)
    .single();
  try {
    const url = await startCheckout(order, user.email);
    return success({ orderId: orderId as string, url });
  } catch (err) {
    console.error("[checkout]", err);
    return failure({ message: "El pedido se creó pero no pudimos abrir el pago. Reintenta desde Mis pedidos." });
  }
}

/** Reabre el pago de un pedido pendiente (pestaña Pendientes). */
export async function resumePayment(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from("orders")
    .select("*, items:order_items(*), business:businesses(trade_name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!user || !order || order.customer_id !== user.id) return failure({ message: "Pedido no encontrado." });
  if (order.status !== "pending_payment" || new Date(order.expires_at) < new Date()) {
    return failure({ message: "Este pedido ya no está pendiente de pago." });
  }
  try {
    return success({ url: await startCheckout(order, user.email) });
  } catch (err) {
    return failure(err, "No pudimos abrir el pago.");
  }
}

/** Pasarela simulada: hace el papel del webhook. Solo existe en modo mock. */
export async function completeMockPayment(orderId: string) {
  const provider = await getPaymentProvider();
  if (provider.name !== "mock") return failure({ message: "El pago simulado está desactivado." });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, total_minor, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!user || !order || order.customer_id !== user.id) return failure({ message: "Pedido no encontrado." });
  try {
    const outcome = await confirmPayment(orderId, "mock", `mock_pi_${crypto.randomUUID().slice(0, 12)}`, order.total_minor);
    return success({ outcome });
  } catch (err) {
    return failure(err, "No pudimos confirmar el pago.");
  }
}
