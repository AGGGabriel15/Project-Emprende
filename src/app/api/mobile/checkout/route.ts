import { mobileReturnUrls, placeOrderWith } from "@/features/checkout/server";
import { appReturnBase, jsonBody, mobileRoute } from "@/lib/mobile-api";

/** Crea el pedido y la sesión de Stripe; al pagar, Stripe vuelve a la app. */
export async function POST(request: Request) {
  return mobileRoute(request, async ({ supabase, user }) => {
    const { input, app } = await jsonBody(request);
    return placeOrderWith(supabase, user, input, mobileReturnUrls(appReturnBase(app)));
  });
}
