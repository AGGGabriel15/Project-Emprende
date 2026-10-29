import type { ClaimReason, OrderStatus, ServiceType } from "@/types/domain";

export const CLAIM_REASONS: Record<ClaimReason, string> = {
  not_received: "No recibí el pedido",
  damaged: "Llegó dañado",
  wrong_item: "No es lo que pedí",
  missing_items: "Faltan productos",
  other: "Otro problema",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  preparing: "En preparación",
  ready: "Listo · espera repartidor",
  ready_for_pickup: "Listo para retirar",
  on_the_way: "En camino",
  delivered: "Entregado",
  disputed: "En reclamo",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  returned: "Devuelto",
};

export type StatusTone = "amber" | "blue" | "violet" | "green" | "red" | "gray";

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending_payment: "amber",
  preparing: "blue",
  ready: "violet",
  ready_for_pickup: "violet",
  on_the_way: "violet",
  delivered: "green",
  disputed: "amber",
  completed: "green",
  cancelled: "red",
  refunded: "gray",
  returned: "gray",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  delivery: "Delivery Catarina Market",
  pickup: "Retiro en el negocio",
};

/** Espejo de public.can_transition() en SQL. */
export function canTransition(from: OrderStatus, to: OrderStatus, service: ServiceType) {
  switch (from) {
    case "pending_payment":
      return to === "preparing" || to === "cancelled";
    case "preparing":
      return (
        (to === "ready" && service === "delivery") ||
        (to === "ready_for_pickup" && service === "pickup") ||
        to === "cancelled"
      );
    case "ready":
      return to === "on_the_way" || to === "cancelled";
    case "ready_for_pickup":
      return to === "delivered" || to === "cancelled";
    case "on_the_way":
      return to === "delivered" || to === "returned" || to === "cancelled";
    case "delivered":
      return to === "completed" || to === "disputed";
    case "disputed":
      return to === "completed" || to === "refunded";
    case "cancelled":
    case "returned":
    case "completed":
      return to === "refunded";
    default:
      return false;
  }
}

/** Lo que el negocio puede hacer en el tablero; cada acción pide su evidencia. */
export function vendorAction(status: OrderStatus, service: ServiceType, hasShipment: boolean) {
  if (status === "preparing") return { kind: "ready" as const, label: "Marcar listo (foto)" };
  if (status === "ready_for_pickup") return { kind: "pin" as const, label: "Entregar con PIN" };
  // Pedidos del modelo anterior que el negocio entrega por su cuenta.
  if (status === "on_the_way" && service === "delivery" && !hasShipment) {
    return { kind: "pin" as const, label: "Entregar con PIN" };
  }
  return null;
}

export const VENDOR_CANCELLABLE: OrderStatus[] = ["preparing", "ready", "ready_for_pickup"];

export const CUSTOMER_TABS = {
  pendientes: ["pending_payment"],
  activos: ["preparing", "ready", "ready_for_pickup", "on_the_way", "disputed"],
  historial: ["delivered", "completed", "cancelled", "refunded", "returned"],
} as const satisfies Record<string, OrderStatus[]>;

export type CustomerTab = keyof typeof CUSTOMER_TABS;

export function customerTabFor(status: OrderStatus): CustomerTab {
  if (status === "pending_payment") return "pendientes";
  if ((CUSTOMER_TABS.activos as readonly OrderStatus[]).includes(status)) return "activos";
  return "historial";
}

/** El cliente necesita su PIN mientras el pedido no se entrega. */
export function showsPin(status: OrderStatus) {
  return ["preparing", "ready", "ready_for_pickup", "on_the_way"].includes(status);
}

/** Pasos de la línea de tiempo según el tipo de servicio. */
export function timelineSteps(service: ServiceType): OrderStatus[] {
  return service === "pickup"
    ? ["pending_payment", "preparing", "ready_for_pickup", "delivered", "completed"]
    : ["pending_payment", "preparing", "ready", "on_the_way", "delivered", "completed"];
}
