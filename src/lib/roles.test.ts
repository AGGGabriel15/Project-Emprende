import { describe, expect, it } from "vitest";
import { canShop, destinationFor } from "./roles";

describe("roles", () => {
  it("solo clientes y visitantes compran", () => {
    expect(canShop(null)).toBe(true);
    expect(canShop("customer")).toBe(true);
    expect(canShop("vendor")).toBe(false);
    expect(canShop("admin")).toBe(false);
  });

  it("tras el login, vendedores y admins van a su panel", () => {
    expect(destinationFor("customer", "/carrito")).toBe("/carrito");
    expect(destinationFor("vendor", "/carrito")).toBe("/vendedor/panel");
    expect(destinationFor("vendor", "/vendedor/pedidos")).toBe("/vendedor/pedidos");
    expect(destinationFor("admin", "/")).toBe("/admin/dashboard");
    expect(destinationFor("admin", "/admin/usuarios")).toBe("/admin/usuarios");
  });
});
