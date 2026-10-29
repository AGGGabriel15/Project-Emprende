import { quoteWith } from "@/features/checkout/server";
import { jsonBody, mobileRoute } from "@/lib/mobile-api";

/** Cotización del pedido para la app móvil (misma lógica que quoteCheckout). */
export async function POST(request: Request) {
  return mobileRoute(request, async ({ supabase }) => {
    const { input, clientPrices } = await jsonBody(request);
    return quoteWith(supabase, input, clientPrices as Record<string, number> | undefined);
  });
}
