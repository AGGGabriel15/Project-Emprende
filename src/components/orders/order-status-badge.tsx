import {
  Ban,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/features/orders/status";
import type { OrderStatus } from "@/types/domain";

export const ORDER_STATUS_ICON = {
  pending_payment: Clock,
  preparing: ChefHat,
  ready_for_pickup: PackageCheck,
  on_the_way: Bike,
  completed: CheckCircle2,
  cancelled: Ban,
  refunded: RotateCcw,
} satisfies Record<OrderStatus, unknown>;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const Icon = ORDER_STATUS_ICON[status];
  return (
    <Badge tone={ORDER_STATUS_TONE[status]}>
      <Icon className="size-3.5" aria-hidden />
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}
