import type { ShipmentStatus, Vehicle } from "@/types/domain";

type Tone = "amber" | "blue" | "violet" | "green" | "red" | "gray";

/** Estado del envío para el repartidor y la administración. */
export const SHIPMENT_STATUS: Record<ShipmentStatus, [string, Tone]> = {
  available: ["Buscando repartidor", "amber"],
  assigned: ["Va al negocio", "blue"],
  at_pickup: ["En el negocio", "blue"],
  picked_up: ["En camino", "violet"],
  at_dropoff: ["Llegó donde el cliente", "violet"],
  delivered: ["Entregado", "green"],
  failed: ["Fallido", "red"],
  rejected: ["Rechazado al recoger", "red"],
  returned: ["Devuelto / cancelado", "gray"],
};

export const ACTIVE_SHIPMENT: ShipmentStatus[] = ["assigned", "at_pickup", "picked_up", "at_dropoff"];

export const VEHICLE_LABEL: Record<Vehicle, string> = { moto: "Moto", bici: "Bicicleta", carro: "Carro" };

/** Lo que el cliente lee sobre su repartidor, paso a paso. */
export const CUSTOMER_COURIER_STEP: Partial<Record<ShipmentStatus, string>> = {
  available: "Estamos buscando un repartidor para tu pedido.",
  assigned: "Tu repartidor va camino al negocio.",
  at_pickup: "Tu repartidor está recogiendo tu pedido.",
  picked_up: "Tu pedido va en camino.",
  at_dropoff: "¡Tu repartidor llegó! Revisa el pedido y dale tu PIN.",
  delivered: "Pedido entregado.",
};

export const RATING_TAGS = ["Amable", "Puntual", "Cuidó el paquete", "Mal trato", "Llegó tarde", "Paquete dañado"] as const;

/** Pasos que ve el repartidor en su app. */
export type CourierStage = "to_pickup" | "at_pickup" | "to_dropoff" | "at_dropoff" | "done";

export function courierStage(status: ShipmentStatus): CourierStage {
  switch (status) {
    case "assigned":
      return "to_pickup";
    case "at_pickup":
      return "at_pickup";
    case "picked_up":
      return "to_dropoff";
    case "at_dropoff":
      return "at_dropoff";
    default:
      return "done";
  }
}
