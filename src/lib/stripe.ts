import Stripe from "stripe";
import { ApiError } from "@/lib/api-response";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("replace_me")) {
    throw new ApiError(
      503,
      "STRIPE_NOT_CONFIGURED",
      "Stripe aún no está configurado.",
    );
  }
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export function paymentMode() {
  return process.env.PAYMENTS_MODE === "stripe" ? "stripe" : "mock";
}
