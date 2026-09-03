import { apiError, ok } from "@/lib/api-response";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { serializeOrder } from "@/lib/order-serializer";
import { requireUser } from "@/lib/session";
import { Order } from "@/models/Order";

export async function GET() {
  try {
    const user = await requireUser();
    const filter: Record<string, unknown> = {};
    if (user.role === "cliente") filter.customer = user._id;
    if (user.role === "emprendedor") {
      const entrepreneur = await entrepreneurForUser(user._id.toString());
      filter.entrepreneur = entrepreneur._id;
    }
    const orders = await Order.find(filter)
      .populate("customer", "name email")
      .populate("entrepreneur", "businessName address phone")
      .sort({ createdAt: -1 })
      .lean();
    return ok(orders.map((order) => serializeOrder(order as never)));
  } catch (error) {
    return apiError(error);
  }
}
