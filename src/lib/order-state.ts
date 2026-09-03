import type { FulfillmentMethod, OrderStatus } from "@/types/domain";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["preparing"],
  preparing: ["ready_for_pickup", "out_for_delivery"],
  ready_for_pickup: ["completed"],
  out_for_delivery: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionOrder(
  current: OrderStatus,
  next: OrderStatus,
  method: FulfillmentMethod,
) {
  if (!transitions[current].includes(next)) return false;
  if (next === "ready_for_pickup") return method === "pickup";
  if (next === "out_for_delivery") return method === "delivery";
  return true;
}
