import { apiError, ok } from "@/lib/api-response";
import {
  releaseExpiredReservations,
  reserveAndCreateOrder,
  releaseOrderStock,
} from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { getStripe, paymentMode } from "@/lib/stripe";
import { checkoutSchema } from "@/validations/checkout";

export async function POST(request: Request) {
  let order: Awaited<ReturnType<typeof reserveAndCreateOrder>> | undefined;
  try {
    const user = await requireUser(["cliente"]);
    const input = checkoutSchema.parse(await request.json());
    await releaseExpiredReservations();
    order = await reserveAndCreateOrder({
      ...input,
      customerId: user._id.toString(),
    });

    if (paymentMode() === "mock") {
      return ok({
        orderId: order._id.toString(),
        checkoutUrl: `/pago-demo?pedido=${order._id.toString()}`,
        mode: "mock",
      });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "nio",
          unit_amount: item.unitPriceMinor,
          product_data: { name: item.name },
        },
        quantity: item.quantity,
      })),
      success_url: `${appUrl}/checkout/exito?pedido=${order._id.toString()}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/carrito?cancelado=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_email: user.email,
      metadata: { orderId: order._id.toString() },
    });
    order.stripeSessionId = session.id;
    await order.save();
    return ok({
      orderId: order._id.toString(),
      checkoutUrl: session.url,
      mode: "stripe",
    });
  } catch (error) {
    if (order) {
      await releaseOrderStock(order);
      order.status = "cancelled";
      order.paymentStatus = "failed";
      await order.save();
    }
    return apiError(error);
  }
}
