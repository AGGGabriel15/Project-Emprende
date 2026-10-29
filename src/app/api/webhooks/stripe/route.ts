import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmPayment } from "@/features/orders/server";
import { getStripe } from "@/features/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vía principal para pasar un pedido a "preparing" con Stripe (respaldo:
 * features/payments/sync consulta la sesión a Stripe al volver del pago).
 * Verifica la firma y procesa cada event.id una vez.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: duplicate } = await admin
    .from("processed_webhook_events")
    .insert({ id: event.id, type: event.type });
  if (duplicate) {
    // 23505 = ya procesado; cualquier otro error se reintenta.
    return duplicate.code === "23505"
      ? NextResponse.json({ received: true, duplicate: true })
      : NextResponse.json({ error: "Error de base de datos." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId && session.payment_status === "paid") {
          const paymentIntent =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null);
          await confirmPayment(orderId, "stripe", paymentIntent, session.amount_total ?? 0);
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const orderId = event.data.object.metadata?.orderId;
        if (orderId) await admin.rpc("expire_pending_orders", { p_order: orderId });
        break;
      }
    }
  } catch (error) {
    // Permite que Stripe reintente el evento.
    await admin.from("processed_webhook_events").delete().eq("id", event.id);
    console.error("[stripe-webhook]", error);
    return NextResponse.json({ error: "No procesado." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
