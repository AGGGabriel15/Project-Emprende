import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "@/lib/order-state";

describe("transiciones de pedido", () => {
  it("sigue la ruta de retiro", () => {
    expect(canTransitionOrder("paid", "preparing", "pickup")).toBe(true);
    expect(canTransitionOrder("preparing", "ready_for_pickup", "pickup")).toBe(
      true,
    );
    expect(canTransitionOrder("ready_for_pickup", "completed", "pickup")).toBe(
      true,
    );
  });

  it("impide mezclar entrega y retiro", () => {
    expect(canTransitionOrder("preparing", "out_for_delivery", "pickup")).toBe(
      false,
    );
    expect(
      canTransitionOrder("preparing", "ready_for_pickup", "delivery"),
    ).toBe(false);
  });

  it("no reabre pedidos terminales", () => {
    expect(canTransitionOrder("completed", "preparing", "delivery")).toBe(
      false,
    );
    expect(canTransitionOrder("cancelled", "paid", "pickup")).toBe(false);
  });
});
