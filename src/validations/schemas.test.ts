import { describe, expect, it } from "vitest";
import { registerSchema } from "@/validations/auth";
import { checkoutSchema } from "@/validations/checkout";

describe("validaciones de entrada", () => {
  it("exige datos del negocio a emprendedores", () => {
    expect(
      registerSchema.safeParse({
        name: "María",
        email: "maria@example.com",
        password: "Demo12345!",
        role: "emprendedor",
      }).success,
    ).toBe(false);
  });

  it("permite registrar clientes sin negocio", () => {
    expect(
      registerSchema.safeParse({
        name: "Carlos",
        email: "carlos@example.com",
        password: "Demo12345!",
        role: "cliente",
      }).success,
    ).toBe(true);
  });

  it("exige dirección únicamente para entrega", () => {
    const base = {
      items: [{ productId: "507f1f77bcf86cd799439011", quantity: 1 }],
      contactName: "Carlos Cliente",
      phone: "88882001",
    };
    expect(
      checkoutSchema.safeParse({ ...base, fulfillmentMethod: "delivery" })
        .success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, fulfillmentMethod: "pickup" })
        .success,
    ).toBe(true);
  });
});
