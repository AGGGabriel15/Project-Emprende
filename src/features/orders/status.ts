import type { OrderStatus, ServiceType } from "@/types/domain";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  on_the_way: "En camino",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export type StatusTone = "amber" | "blue" | "violet" | "green" | "red" | "gray";

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending_payment: "amber",
  preparing: "blue",
  ready_for_pickup: "violet",
  on_the_way: "violet",
  completed: "green",
  cancelled: "red",
  refunded: "gray",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  delivery: "Delivery",
  pickup: "Para llevar",
};

/** Espejo de public.can_transition() en SQL. */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  service: ServiceType,
) {
  switch (from) {
    case "pending_payment":
      return to === "preparing" || to === "cancelled";
    case "preparing":
      return (
        (to === "ready_for_pickup" && service === "pickup") ||
        (to === "on_the_way" && service === "delivery") ||
        to === "cancelled"
      );
    case "ready_for_pickup":
    case "on_the_way":
      return to === "completed" || to === "cancelled";
    case "cancelled":
      return to === "refunded";
    default:
      return false;
  }
}

/** Siguiente acción que el negocio puede ejecutar desde el tablero. */
export function nextVendorAction(
  status: OrderStatus,
  service: ServiceType,
): { to: OrderStatus; label: string } | null {
  if (status === "preparing") {
    return service === "pickup"
      ? { to: "ready_for_pickup", label: "Marcar listo para retirar" }
      : { to: "on_the_way", label: "Marcar en camino" };
  }
  if (status === "ready_for_pickup") return { to: "completed", label: "Entregado al cliente" };
  if (status === "on_the_way") return { to: "completed", label: "Marcar entregado" };
  return null;
}

export const CANCELLABLE: OrderStatus[] = ["preparing", "ready_for_pickup", "on_the_way"];

export const CUSTOMER_TABS = {
  pendientes: ["pending_payment"],
  activos: ["preparing", "ready_for_pickup", "on_the_way"],
  historial: ["completed", "cancelled", "refunded"],
} as const satisfies Record<string, OrderStatus[]>;

export type CustomerTab = keyof typeof CUSTOMER_TABS;

export function customerTabFor(status: OrderStatus): CustomerTab {
  if (status === "pending_payment") return "pendientes";
  if ((CUSTOMER_TABS.activos as readonly OrderStatus[]).includes(status)) return "activos";
  return "historial";
}

/** Pasos de la línea de tiempo según el tipo de servicio. */
export function timelineSteps(service: ServiceType): OrderStatus[] {
  return [
    "pending_payment",
    "preparing",
    service === "pickup" ? "ready_for_pickup" : "on_the_way",
    "completed",
  ];
}
