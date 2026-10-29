import { mobileReturnUrls, resumePaymentWith } from "@/features/checkout/server";
import { appReturnBase, jsonBody, mobileRoute } from "@/lib/mobile-api";

/** Reabre el pago de un pedido pendiente desde la app. */
export async function POST(request: Request, ctx: RouteContext<"/api/mobile/orders/[id]/pay">) {
  const { id } = await ctx.params;
  return mobileRoute(request, async ({ supabase, user }) => {
    const { app } = await jsonBody(request);
    return resumePaymentWith(supabase, user, id, mobileReturnUrls(appReturnBase(app)));
  });
}
