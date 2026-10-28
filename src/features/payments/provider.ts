/**
 * Los pagos se aíslan detrás de esta interfaz: cambiar Stripe por una pasarela
 * regional solo requiere otra implementación (Stripe no opera en Nicaragua;
 * aquí se usa en modo test).
 */
export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  businessName: string;
  items: { name: string; unitPriceMinor: number; quantity: number }[];
  deliveryFeeMinor: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { url: string; sessionId: string | null };

export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Devuelve la referencia del reembolso en el proveedor (null si es simulado). */
  refund(paymentRef: string | null, amountMinor: number): Promise<string | null>;
}

export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (process.env.PAYMENTS_MODE !== "mock" && stripeConfigured()) {
    const { stripeProvider } = await import("./stripe");
    return stripeProvider;
  }
  const { mockProvider } = await import("./mock");
  return mockProvider;
}
