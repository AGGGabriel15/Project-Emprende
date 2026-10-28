import type { PaymentProvider } from "./provider";

/** Pasarela simulada para desarrollo y demos sin llaves de Stripe. */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(request) {
    return { url: `/checkout/pago-demo/${request.orderId}`, sessionId: null };
  },
  async refund() {
    return `mock_re_${crypto.randomUUID().slice(0, 8)}`;
  },
};
