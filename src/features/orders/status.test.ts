import { describe, expect, it } from "vitest";
import { canTransition, customerTabFor, nextVendorAction } from "./status";

describe("máquina de estados del pedido", () => {
  it("el pago confirmado pasa directo a preparación (sin aceptación del local)", () => {
    expect(canTransition("pending_payment", "preparing", "pickup")).toBe(true);
    expect(canTransition("pending_payment", "completed", "pickup")).toBe(false);
  });

  it("Para llevar va a Listo para retirar y Delivery a En camino", () => {
    expect(canTransition("preparing", "ready_for_pickup", "pickup")).toBe(true);
    expect(canTransition("preparing", "on_the_way", "pickup")).toBe(false);
    expect(canTransition("preparing", "on_the_way", "delivery")).toBe(true);
    expect(canTransition("preparing", "ready_for_pickup", "delivery")).toBe(false);
  });

  it("solo se cancela desde preparación, listo o en camino; luego se reembolsa", () => {
    for (const status of ["preparing", "ready_for_pickup", "on_the_way"] as const) {
      expect(canTransition(status, "cancelled", "delivery")).toBe(true);
    }
    expect(canTransition("completed", "cancelled", "delivery")).toBe(false);
    expect(canTransition("cancelled", "refunded", "delivery")).toBe(true);
    expect(canTransition("refunded", "preparing", "delivery")).toBe(false);
  });

  it("sugiere la siguiente acción del negocio", () => {
    expect(nextVendorAction("preparing", "pickup")?.to).toBe("ready_for_pickup");
    expect(nextVendorAction("preparing", "delivery")?.to).toBe("on_the_way");
    expect(nextVendorAction("on_the_way", "delivery")?.to).toBe("completed");
    expect(nextVendorAction("completed", "delivery")).toBeNull();
  });

  it("agrupa en Pendientes, Activos e Historial", () => {
    expect(customerTabFor("pending_payment")).toBe("pendientes");
    expect(customerTabFor("on_the_way")).toBe("activos");
    expect(customerTabFor("refunded")).toBe("historial");
  });
});
