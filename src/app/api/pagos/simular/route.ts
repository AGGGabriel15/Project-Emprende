import { apiError, ApiError, ok } from "@/lib/api-response";
import { sendOrderConfirmation } from "@/lib/email";
import { markOrderPaid } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { paymentMode } from "@/lib/stripe";
import { Order } from "@/models/Order";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    if (paymentMode() !== "mock") {
      throw new ApiError(404, "NOT_FOUND", "La simulación no está habilitada.");
    }
    const user = await requireUser(["cliente"]);
    const { orderId } = z
      .object({ orderId: z.string().regex(/^[a-f\d]{24}$/i) })
      .parse(await request.json());
    const order = await Order.findOne({ _id: orderId, customer: user._id });
    if (!order) throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado.");
    const paid = await markOrderPaid(orderId, `mock_${crypto.randomUUID()}`);
    if (!paid && order.paymentStatus !== "paid") {
      throw new ApiError(409, "INVALID_ORDER", "El pedido no puede pagarse.");
    }
    await sendOrderConfirmation(orderId);
    return ok({ orderId, paid: true });
  } catch (error) {
    return apiError(error);
  }
}
