import { apiError, ApiError, ok } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { markOrderPaid, releaseOrderStock } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { Order } from "@/models/Order";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret || secret.includes("replace_me")) {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK",
        "Webhook de Stripe no configurado.",
      );
    }
    const event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
    await connectDB();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const paid = await markOrderPaid(
          orderId,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : undefined,
        );
        if (paid) await sendOrderConfirmation(orderId);
      }
    }
    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object;
      const order = await Order.findOne({ stripeSessionId: session.id });
      if (order && order.paymentStatus === "pending") {
        await releaseOrderStock(order);
        order.paymentStatus =
          event.type === "checkout.session.expired" ? "expired" : "failed";
        order.status = "cancelled";
        await order.save();
      }
    }
    return ok({ received: true });
  } catch (error) {
    return apiError(error);
  }
}
