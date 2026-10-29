import { signEvidence } from "@/features/logistics/evidence";
import { isOrderParticipant, mobileRoute } from "@/lib/mobile-api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * URLs firmadas (10 min) de las fotos de evidencia de un pedido: empacado,
 * recogida, entrega y fotos de reclamos. Solo para quienes participan en él.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/mobile/orders/[id]/evidence">) {
  const { id } = await ctx.params;
  return mobileRoute(request, async ({ user }) => {
    if (!(await isOrderParticipant(id, user.id))) return { ok: false, error: "Pedido no encontrado." };
    const { data: order } = await createAdminClient()
      .from("orders")
      .select("ready_photo_path, shipments(pickup_photo_path, delivery_photo_path), claims(photo_paths)")
      .eq("id", id)
      .single();
    const shipments = (order?.shipments ?? []) as { pickup_photo_path: string | null; delivery_photo_path: string | null }[];
    const claims = (order?.claims ?? []) as { photo_paths: string[] }[];
    return {
      ok: true,
      data: await signEvidence([
        order?.ready_photo_path,
        ...shipments.flatMap((s) => [s.pickup_photo_path, s.delivery_photo_path]),
        ...claims.flatMap((c) => c.photo_paths),
      ]),
    };
  });
}
