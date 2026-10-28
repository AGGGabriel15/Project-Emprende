import { beforeEach, describe, expect, it } from "vitest";
import { cartCount, groupByBusiness, useCart } from "./store";

const product = (id: string, businessId: string, stock = 5, priceMinor = 1_000) => ({
  productId: id,
  businessId,
  businessName: `Negocio ${businessId}`,
  businessSlug: businessId,
  name: `Producto ${id}`,
  priceMinor,
  stock,
});

describe("carrito agrupado por negocio", () => {
  beforeEach(() => useCart.getState().clear());

  it("permite productos de varios negocios sin vaciar el carrito", () => {
    useCart.getState().add(product("p1", "a"));
    useCart.getState().add(product("p2", "b"));
    const groups = groupByBusiness(useCart.getState().items);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.businessId)).toEqual(["a", "b"]);
  });

  it("calcula el subtotal de cada grupo", () => {
    useCart.getState().add(product("p1", "a", 5, 1_500), 2);
    useCart.getState().add(product("p2", "a", 5, 500));
    const [group] = groupByBusiness(useCart.getState().items);
    expect(group.subtotal).toBe(3_500);
    expect(group.count).toBe(3);
  });

  it("nunca supera el stock disponible", () => {
    useCart.getState().add(product("p1", "a", 2), 5);
    expect(useCart.getState().items[0].quantity).toBe(2);
    useCart.getState().setQuantity("p1", 10);
    expect(useCart.getState().items[0].quantity).toBe(2);
    useCart.getState().setQuantity("p1", 0);
    expect(useCart.getState().items[0].quantity).toBe(1);
  });

  it("vacía solo el negocio pagado", () => {
    useCart.getState().add(product("p1", "a"));
    useCart.getState().add(product("p2", "b"));
    useCart.getState().clearBusiness("a");
    expect(useCart.getState().items.map((i) => i.businessId)).toEqual(["b"]);
    expect(cartCount(useCart.getState().items)).toBe(1);
  });
});
