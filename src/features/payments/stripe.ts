import Stripe from "stripe";
import type { PaymentProvider } from "./provider";

let client: Stripe | undefined;

export function getStripe() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(request) {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = request.items.map((item) => ({
      price_data: {
        currency: "nio",
        unit_amount: item.unitPriceMinor,
        product_data: { name: item.name },
      },
      quantity: item.quantity,
    }));
    if (request.deliveryFeeMinor > 0) {
      lineItems.push({
        price_data: {
          currency: "nio",
          unit_amount: request.deliveryFeeMinor,
          product_data: { name: "Delivery" },
        },
        quantity: 1,
      });
    }
    // El total cobrado debe ser igual a orders.total_minor (productos + envío + servicio).
    if (request.serviceFeeMinor > 0) {
      lineItems.push({
        price_data: {
          currency: "nio",
          unit_amount: request.serviceFeeMinor,
          product_data: { name: "Tarifa de servicio" },
        },
        quantity: 1,
      });
    }
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: request.customerEmail,
      client_reference_id: request.orderId,
      metadata: { orderId: request.orderId, orderNumber: request.orderNumber },
      payment_intent_data: {
        metadata: { orderId: request.orderId },
        description: `${request.orderNumber} · ${request.businessName}`,
      },
      success_url: `${request.successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      locale: "es",
    });
    return { url: session.url!, sessionId: session.id };
  },
  async refund(paymentRef, amountMinor) {
    if (!paymentRef) return null;
    const refund = await getStripe().refunds.create({
      payment_intent: paymentRef,
      amount: amountMinor,
    });
    return refund.id;
  },
};
