import { confirmPayment } from "@/features/orders/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeConfigured } from "./provider";
import { getStripe } from "./stripe";

/**
 * Consulta a Stripe el estado de la sesión de pago de un pedido pendiente y lo
 * acredita si ya está pagado. Complementa al webhook (si `stripe listen` no está
 * corriendo o el evento se retrasa). Usa la sesión guardada en el pedido, nunca
 * un id recibido del navegador, y confirmPayment es idempotente.
 * El llamador debe haber comprobado que el usuario puede ver el pedido.
 */
export async function syncStripePayment(orderId: string) {
  if (!stripeConfigured()) return null;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_provider, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.stripe_session_id || order.payment_provider !== "stripe" || order.status !== "pending_payment") {
    return null;
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(order.stripe_session_id);
    if (session.metadata?.orderId !== order.id) return null;
    if (session.payment_status === "paid") {
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      return await confirmPayment(order.id, "stripe", paymentIntent, session.amount_total ?? 0);
    }
    if (session.status === "expired") {
      await admin.rpc("expire_pending_orders", { p_order: order.id });
      return "expired";
    }
  } catch (error) {
    console.error("[stripe-sync]", error);
  }
  return null;
}

/** Sincroniza varios pedidos pendientes (p. ej. al abrir "Mis pedidos"); true si alguno cambió. */
export async function syncStripePayments(orderIds: string[]) {
  const outcomes = await Promise.all(orderIds.slice(0, 10).map((id) => syncStripePayment(id)));
  return outcomes.some(Boolean);
}

/** URL de la sesión de Stripe del pedido si sigue abierta (para no crear otra). */
export async function openStripeCheckoutUrl(orderId: string) {
  if (!stripeConfigured()) return null;
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id, payment_provider, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.stripe_session_id || order.payment_provider !== "stripe") return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(order.stripe_session_id);
    return session.status === "open" && session.metadata?.orderId === order.id ? session.url : null;
  } catch {
    return null;
  }
}
