import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email", () => ({ button: vi.fn(), escape: (s: string) => s, orderSummaryHtml: vi.fn(), sendEmail: vi.fn() }));

const { refundErrorMessage } = await import("./server");

describe("errores de reembolso en español", () => {
  it("traduce los mensajes de Stripe", () => {
    expect(refundErrorMessage(new Error("Refund amount (385.00 C$) is greater than charge amount (370.00 C$)"))).toBe(
      "El monto a devolver supera lo que se cobró en la tarjeta.",
    );
    expect(refundErrorMessage(new Error("Charge ch_1 has already been refunded."))).toBe("Ese cobro ya fue reembolsado por completo.");
    expect(refundErrorMessage(new Error("Some unexpected gateway failure"))).toMatch(/^La pasarela de pago rechazó/);
  });

  it("deja pasar los mensajes que ya están en español", () => {
    expect(refundErrorMessage(new Error("Ese cobro ya fue reembolsado por completo."))).toBe("Ese cobro ya fue reembolsado por completo.");
  });
});
