import { describe, expect, it } from "vitest";
import { canTransition, customerTabFor, showsPin, vendorAction } from "./status";

describe("máquina de estados del pedido", () => {
  it("el pago confirmado pasa directo a preparación (sin aceptación del local)", () => {
    expect(canTransition("pending_payment", "preparing", "pickup")).toBe(true);
    expect(canTransition("pending_payment", "completed", "pickup")).toBe(false);
  });

  it("cada servicio tiene su camino con evidencia", () => {
    expect(canTransition("preparing", "ready_for_pickup", "pickup")).toBe(true);
    expect(canTransition("preparing", "ready", "pickup")).toBe(false);
    expect(canTransition("preparing", "ready", "delivery")).toBe(true);
    expect(canTransition("preparing", "on_the_way", "delivery")).toBe(false);
    expect(canTransition("ready", "on_the_way", "delivery")).toBe(true);
    expect(canTransition("on_the_way", "delivered", "delivery")).toBe(true);
    expect(canTransition("ready_for_pickup", "delivered", "pickup")).toBe(true);
  });

  it("la entrega no completa de inmediato: pasa por la ventana de reclamo", () => {
    expect(canTransition("on_the_way", "completed", "delivery")).toBe(false);
    expect(canTransition("delivered", "completed", "delivery")).toBe(true);
    expect(canTransition("delivered", "disputed", "delivery")).toBe(true);
    expect(canTransition("disputed", "refunded", "delivery")).toBe(true);
  });

  it("cancelación antes de recoger; luego solo devolución o reembolso", () => {
    for (const status of ["preparing", "ready", "ready_for_pickup"] as const) {
      expect(canTransition(status, "cancelled", status === "ready" ? "delivery" : "pickup")).toBe(true);
    }
    expect(canTransition("on_the_way", "returned", "delivery")).toBe(true);
    expect(canTransition("completed", "cancelled", "delivery")).toBe(false);
    expect(canTransition("returned", "refunded", "delivery")).toBe(true);
  });

  it("el negocio solo marca listo (foto) o entrega con PIN", () => {
    expect(vendorAction("preparing", "delivery", false)?.kind).toBe("ready");
    expect(vendorAction("ready_for_pickup", "pickup", false)?.kind).toBe("pin");
    expect(vendorAction("ready", "delivery", false)).toBeNull();
    expect(vendorAction("on_the_way", "delivery", true)).toBeNull();
    expect(vendorAction("on_the_way", "delivery", false)?.kind).toBe("pin");
  });

  it("el cliente ve su PIN hasta la entrega", () => {
    expect(showsPin("on_the_way")).toBe(true);
    expect(showsPin("delivered")).toBe(false);
  });

  it("agrupa en Pendientes, Activos e Historial", () => {
    expect(customerTabFor("pending_payment")).toBe("pendientes");
    expect(customerTabFor("on_the_way")).toBe("activos");
    expect(customerTabFor("refunded")).toBe("historial");
    expect(customerTabFor("disputed")).toBe("activos");
    expect(customerTabFor("delivered")).toBe("historial");
  });
});
