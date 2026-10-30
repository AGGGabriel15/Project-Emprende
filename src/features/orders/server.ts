import { button, escape, orderSummaryHtml, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/features/payments/provider";

/**
 * Operaciones de servidor con service role. Solo se llaman desde el webhook,
 * el pago simulado o Server Actions que ya validaron permisos.
 */

async function loadOrderForEmail(orderId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "*, items:order_items(product_name, quantity, subtotal_minor), customer:profiles!orders_customer_id_fkey(email, full_name), business:businesses(trade_name, owner:profiles!businesses_owner_id_fkey(email))",
    )
    .eq("id", orderId)
    .single();
  return data;
}

/**
 * Quita del carrito guardado (carts/cart_items) los productos de un pedido.
 * Se llama al crear el pedido y al confirmar el pago, para que la
 * sincronización del carrito no los devuelva al navegador.
 */
export async function removeOrderedFromCart(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("customer_id, business_id, items:order_items(product_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  const { data: cart } = await admin
    .from("carts")
    .select("id")
    .eq("user_id", order.customer_id)
    .eq("business_id", order.business_id)
    .maybeSingle();
  if (!cart) return;
  const productIds = (order.items ?? []).map((item: { product_id: string | null }) => item.product_id).filter(Boolean);
  if (productIds.length) await admin.from("cart_items").delete().eq("cart_id", cart.id).in("product_id", productIds);
  const { count } = await admin.from("cart_items").select("product_id", { count: "exact", head: true }).eq("cart_id", cart.id);
  if (!count) await admin.from("carts").delete().eq("id", cart.id);
}

/** Acredita el pago: stock, estado preparing, notificaciones y correos. Idempotente. */
export async function confirmPayment(
  orderId: string,
  provider: "stripe" | "mock",
  paymentRef: string | null,
  amountMinor: number,
) {
  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("confirm_order_payment", {
    p_order: orderId,
    p_provider: provider,
    p_ref: paymentRef,
    p_amount: amountMinor,
  });
  if (error) throw error;

  if (outcome === "refund_required") {
    await refundOrder(orderId, "Pedido sin existencias o vencido al confirmar el pago");
    return outcome as string;
  }
  if (outcome === "confirmed") {
    await removeOrderedFromCart(orderId);
    const order = await loadOrderForEmail(orderId);
    if (order) {
      await Promise.all([
        sendEmail(
          order.customer?.email,
          `Pedido ${order.order_number} confirmado`,
          `<p>¡Gracias, ${escape(order.customer?.full_name ?? "")}! <strong>${escape(order.business?.trade_name ?? "")}</strong> ya está preparando tu pedido.</p>${orderSummaryHtml(order)}${button(`/pedidos/${orderId}`, "Seguir mi pedido")}`,
        ),
        sendEmail(
          order.business?.owner?.email,
          `Nuevo pedido ${order.order_number}`,
          `<p>Tienes un pedido nuevo para ${order.service_type === "delivery" ? "delivery" : "retirar en el local"}.</p>${orderSummaryHtml(order)}${button("/vendedor/pedidos", "Abrir tablero de pedidos")}`,
        ),
      ]);
    }
  }
  return outcome as string;
}

type PendingRefund = {
  id: string;
  order_id: string;
  amount_minor: number;
  reason: string;
  payment: { provider: string; provider_ref: string | null; amount_minor: number } | null;
};

/** Mensajes de la pasarela en español (Stripe responde en inglés). */
export function refundErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/greater than (the )?(charge|unrefunded) amount/i.test(message)) return "El monto a devolver supera lo que se cobró en la tarjeta.";
  if (/already been refunded|charge_already_refunded/i.test(message)) return "Ese cobro ya fue reembolsado por completo.";
  if (/No such payment_intent|resource_missing/i.test(message)) return "La pasarela no encuentra el pago: reembolsa manualmente desde Stripe.";
  if (/disputed|charge_disputed/i.test(message)) return "El cobro está en disputa con el banco: no se puede reembolsar ahora.";
  if (/[áéíóúñ¿¡]|^(El|La|Ese|No) /i.test(message)) return message;
  return "La pasarela de pago rechazó el reembolso. Intenta de nuevo o revisa el pago en Stripe.";
}

/**
 * Ejecuta en la pasarela los reembolsos en cola (los crea la base: cancelaciones,
 * reclamos, entregas fallidas…) y los confirma con complete_refund().
 */
export async function processPendingRefunds(orderId?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("refunds")
    .select("id, order_id, amount_minor, reason, payment:payments(provider, provider_ref, amount_minor)")
    .in("status", ["pending", "failed"])
    .order("created_at")
    .limit(50);
  if (orderId) query = query.eq("order_id", orderId);
  const { data } = await query;
  const provider = await getPaymentProvider();
  let processed = 0;
  let failed = 0;

  for (const refund of (data ?? []) as unknown as PendingRefund[]) {
    try {
      // Nunca se devuelve más de lo que realmente se cobró (menos lo ya devuelto).
      if (refund.payment) {
        const { data: done } = await admin.from("refunds").select("amount_minor").eq("order_id", refund.order_id).eq("status", "processed");
        const refunded = (done ?? []).reduce((sum, r) => sum + (r.amount_minor as number), 0);
        const available = Math.max(0, refund.payment.amount_minor - refunded);
        if (available === 0) throw new Error("Ese cobro ya fue reembolsado por completo.");
        if (refund.amount_minor > available) {
          await admin.from("refunds").update({ amount_minor: available }).eq("id", refund.id);
          refund.amount_minor = available;
        }
      }
      let reference: string;
      if (refund.payment?.provider === provider.name && provider.name === "stripe") {
        if (!refund.payment.provider_ref) throw new Error("El pago no tiene referencia en Stripe: reembolsa manualmente.");
        reference = (await provider.refund(refund.payment.provider_ref, refund.amount_minor)) ?? "";
        if (!reference) throw new Error("Stripe no devolvió referencia.");
      } else {
        reference = `simulado_${crypto.randomUUID().slice(0, 8)}`;
      }
      const { error } = await admin.rpc("complete_refund", { p_refund: refund.id, p_provider_ref: reference });
      if (error) throw error;
      processed++;
      const order = await loadOrderForEmail(refund.order_id);
      if (order) {
        await sendEmail(
          order.customer?.email,
          `Reembolso del pedido ${order.order_number}`,
          `<p>Te devolvimos <strong>C$ ${(refund.amount_minor / 100).toFixed(2)}</strong>.</p><p><strong>Motivo:</strong> ${escape(refund.reason)}</p>${orderSummaryHtml(order)}`,
        );
      }
    } catch (error) {
      failed++;
      console.error("[refund]", error);
      await admin.rpc("complete_refund", {
        p_refund: refund.id,
        p_provider_ref: null,
        p_error: refundErrorMessage(error),
      });
    }
  }
  return { processed, failed };
}

/** Pago confirmado sobre un pedido vencido o sin stock: se devuelve todo. */
export async function refundOrder(orderId: string, reason: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("total_minor").eq("id", orderId).single();
  if (!order) return;
  await admin.rpc("queue_refund", {
    p_order: orderId,
    p_amount: order.total_minor,
    p_reason: reason,
    p_responsible: "platform",
  });
  await processPendingRefunds(orderId);
}
