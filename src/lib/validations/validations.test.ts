import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";
import { checkoutSchema } from "./checkout";
import { cedulaSchema, phoneSchema, rucSchema } from "./common";
import { formatCedula, formatPhone, splitPhone, whatsappHref } from "@/lib/phone";

describe("validaciones de Nicaragua", () => {
  it("normaliza teléfonos a E.164 (Nicaragua por defecto)", () => {
    expect(phoneSchema.parse("+505 8888-1234")).toBe("+50588881234");
    expect(phoneSchema.parse("7312 3134")).toBe("+50573123134");
    expect(phoneSchema.safeParse("1234").success).toBe(false);
    expect(phoneSchema.safeParse("+505 3312 3134").success).toBe(false);
  });

  it("acepta teléfonos extranjeros", () => {
    expect(phoneSchema.parse("+506 8312 3456")).toBe("+50683123456");
    expect(phoneSchema.parse("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("valida cédula con letra final y la guarda con guiones", () => {
    expect(cedulaSchema.parse("0011203071017x")).toBe("001-120307-1017X");
    expect(cedulaSchema.safeParse("001-010190-0001").success).toBe(false);
  });

  it("valida RUC de persona jurídica y natural", () => {
    expect(rucSchema.parse("j0310000000001")).toBe("J0310000000001");
    expect(rucSchema.safeParse("0010101900001A").success).toBe(true);
    expect(rucSchema.safeParse("12345").success).toBe(false);
  });
});

describe("registro y checkout", () => {
  it("exige aceptar términos y privacidad (Ley 787)", () => {
    const base = { fullName: "Ana López", email: "ana@example.com", password: "Catarina2026" };
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: true }).success).toBe(true);
  });

  it("exige dirección solo para Delivery", () => {
    const base = {
      businessId: "3f1c1f9e-1d2b-4c3a-9b8e-1a2b3c4d5e6f",
      items: [{ productId: "4f1c1f9e-1d2b-4c3a-9b8e-1a2b3c4d5e6f", quantity: 1 }],
      contactName: "Ana",
      contactPhone: "88881234",
    };
    expect(checkoutSchema.safeParse({ ...base, serviceType: "delivery" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, serviceType: "pickup" }).success).toBe(true);
  });
});

describe("formato de teléfono y cédula al escribir", () => {
  it("formatea la cédula por partes", () => {
    expect(formatCedula("001")).toBe("001");
    expect(formatCedula("0011")).toBe("001-1");
    expect(formatCedula("0011203071017x")).toBe("001-120307-1017X");
    expect(formatCedula("001-120307-1017XY9")).toBe("001-120307-1017X");
  });

  it("muestra y enlaza teléfonos guardados", () => {
    expect(formatPhone("+50573123134")).toBe("+505 7312 3134");
    expect(formatPhone("88881234")).toBe("+505 8888 1234");
    expect(whatsappHref("+50573123134")).toBe("https://wa.me/50573123134");
    expect(splitPhone("+14155552671")).toEqual({ country: "US", digits: "4155552671" });
  });
});
