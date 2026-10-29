import { syncStripePayment } from "@/features/payments/sync";
import { mobileRoute } from "@/lib/mobile-api";

/** Al volver de Stripe, acredita el pago si el webhook aún no llegó. */
export async function POST(request: Request, ctx: RouteContext<"/api/mobile/orders/[id]/sync">) {
  const { id } = await ctx.params;
  return mobileRoute(request, async ({ supabase, user }) => {
    const { data: order } = await supabase.from("orders").select("id, customer_id").eq("id", id).maybeSingle();
    if (!order || order.customer_id !== user.id) return { ok: false, error: "Pedido no encontrado." };
    return { ok: true, data: { outcome: await syncStripePayment(id) } };
  });
}
