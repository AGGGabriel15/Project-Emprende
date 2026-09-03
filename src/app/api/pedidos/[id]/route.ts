import { z } from "zod";
import { apiError, ApiError, ok } from "@/lib/api-response";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { serializeOrder } from "@/lib/order-serializer";
import { canTransitionOrder } from "@/lib/order-state";
import { requireUser } from "@/lib/session";
import { Order } from "@/models/Order";

type Context = { params: Promise<{ id: string }> };
const statusSchema = z.object({
  status: z.enum([
    "preparing",
    "ready_for_pickup",
    "out_for_delivery",
    "completed",
  ]),
});

async function authorizedOrder(id: string) {
  const user = await requireUser();
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado.");
  if (user.role === "cliente" && !order.customer.equals(user._id)) {
    throw new ApiError(403, "FORBIDDEN", "No puedes consultar este pedido.");
  }
  if (user.role === "emprendedor") {
    const entrepreneur = await entrepreneurForUser(user._id.toString());
    if (!order.entrepreneur.equals(entrepreneur._id)) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Este pedido pertenece a otro emprendedor.",
      );
    }
  }
  return { order, user };
}

export async function GET(_: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { order } = await authorizedOrder(id);
    await order.populate([
      { path: "customer", select: "name email" },
      { path: "entrepreneur", select: "businessName address phone" },
    ]);
    return ok(serializeOrder(order.toObject() as never));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { order, user } = await authorizedOrder(id);
    if (user.role === "cliente") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Los clientes no pueden cambiar el estado.",
      );
    }
    const { status } = statusSchema.parse(await request.json());
    if (!canTransitionOrder(order.status, status, order.fulfillmentMethod)) {
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "Ese cambio de estado no está permitido.",
      );
    }
    order.status = status;
    await order.save();
    return ok({ id, status });
  } catch (error) {
    return apiError(error);
  }
}
