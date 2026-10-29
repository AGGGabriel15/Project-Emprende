import { describe, expect, it } from "vitest";
import { ACTIVE_SHIPMENT, courierStage, SHIPMENT_STATUS } from "./status";

describe("pasos del repartidor", () => {
  it("cada estado activo tiene un paso con acción", () => {
    expect(ACTIVE_SHIPMENT.map(courierStage)).toEqual(["to_pickup", "at_pickup", "to_dropoff", "at_dropoff"]);
  });

  it("los estados terminados no permiten acciones", () => {
    for (const status of ["available", "delivered", "failed", "rejected", "returned"] as const) {
      expect(courierStage(status)).toBe("done");
    }
  });

  it("todos los estados tienen etiqueta", () => {
    expect(Object.keys(SHIPMENT_STATUS)).toHaveLength(9);
  });
});
