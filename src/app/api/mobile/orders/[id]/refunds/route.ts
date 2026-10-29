import { processPendingRefunds } from "@/features/orders/server";
import { isOrderParticipant, mobileRoute } from "@/lib/mobile-api";

/**
 * Ejecuta al momento los reembolsos que la base dejó en cola para un pedido
 * (cancelación, rechazo o entrega fallida). Solo el cliente, el dueño del
 * negocio o el repartidor del pedido pueden pedirlo; el cron diario es el respaldo.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/mobile/orders/[id]/refunds">) {
  const { id } = await ctx.params;
  return mobileRoute(request, async ({ user }) => {
    if (!(await isOrderParticipant(id, user.id))) return { ok: false, error: "Pedido no encontrado." };
    return { ok: true, data: await processPendingRefunds(id) };
  });
}
