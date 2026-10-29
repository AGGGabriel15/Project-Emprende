import {
  AlertTriangle,
  Ban,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  HandHeart,
  Package,
  PackageCheck,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/features/orders/status";
import type { OrderStatus } from "@/types/domain";

export const ORDER_STATUS_ICON = {
  pending_payment: Clock,
  preparing: ChefHat,
  ready: Package,
  ready_for_pickup: PackageCheck,
  on_the_way: Bike,
  delivered: HandHeart,
  disputed: AlertTriangle,
  completed: CheckCircle2,
  cancelled: Ban,
  refunded: RotateCcw,
  returned: Undo2,
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
