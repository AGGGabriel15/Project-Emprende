import { beforeEach, describe, expect, it } from "vitest";
import { useCart } from "@/store/cart";

const base = {
  productId: "p1",
  name: "Canasta",
  priceMinor: 10000,
  stock: 3,
  entrepreneurId: "e1",
  businessName: "Manos",
};

describe("carrito por emprendedor", () => {
  beforeEach(() => useCart.getState().clear());

  it("limita la cantidad por inventario", () => {
    useCart.getState().add(base);
    useCart.getState().setQuantity("p1", 20);
    expect(useCart.getState().items[0].quantity).toBe(3);
  });

  it("rechaza otro vendedor hasta confirmar reemplazo", () => {
    useCart.getState().add(base);
    const other = { ...base, productId: "p2", entrepreneurId: "e2" };
    expect(useCart.getState().add(other)).toBe(false);
    expect(useCart.getState().items[0].productId).toBe("p1");
    expect(useCart.getState().add(other, true)).toBe(true);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].productId).toBe("p2");
  });
});
