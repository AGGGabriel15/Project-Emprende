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
    await refundOrder(orderId, "Pedido sin existencias o vencido al confirmar el pago", null);
    return outcome as string;
  }
  if (outcome === "confirmed") {
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

/** Reembolsa en el proveedor y registra el refund (estado refunded). */
export async function refundOrder(orderId: string, reason: string, processedBy: string | null) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_minor, payment_provider, stripe_payment_intent_id, payment_status")
    .eq("id", orderId)
    .single();
  if (!order || order.payment_status !== "paid") return;

  const { data: payment } = await admin
    .from("payments")
    .select("provider, provider_ref")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let providerRef: string | null = null;
  const provider = await getPaymentProvider();
  try {
    providerRef =
      payment?.provider === provider.name
        ? await provider.refund(payment.provider_ref, order.total_minor)
        : `simulado_${crypto.randomUUID().slice(0, 8)}`;
  } catch (error) {
    console.error("[refund]", error);
    providerRef = `pendiente_manual_${crypto.randomUUID().slice(0, 8)}`;
  }
  const { error } = await admin.rpc("record_refund", {
    p_order: orderId,
    p_reason: reason,
    p_provider_ref: providerRef,
    p_processed_by: processedBy,
  });
  if (error) throw error;

  const full = await loadOrderForEmail(orderId);
  if (full) {
    await sendEmail(
      full.customer?.email,
      `Reembolso del pedido ${full.order_number}`,
      `<p>Cancelamos tu pedido y devolvimos el pago.</p><p><strong>Motivo:</strong> ${escape(full.cancel_reason ?? reason)}</p>${orderSummaryHtml(full)}`,
    );
  }
}
