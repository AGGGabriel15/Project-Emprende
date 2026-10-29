import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authFromRequest } from "@/lib/supabase/bearer";

type MobileSession = { supabase: SupabaseClient; user: User };

/**
 * Envuelve una ruta de /api/mobile: exige el token de la app y responde
 * siempre JSON con la forma de ActionResult ({ ok, data } | { ok, error }).
 */
export async function mobileRoute(request: Request, handler: (session: MobileSession) => Promise<unknown>) {
  const session = await authFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Inicia sesión de nuevo." }, { status: 401 });
  try {
    return NextResponse.json(await handler(session));
  } catch (err) {
    console.error("[api/mobile]", err);
    return NextResponse.json({ ok: false, error: "Ocurrió un error inesperado." }, { status: 500 });
  }
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

/**
 * Dónde reabrir la app al volver del pago: el esquema propio en las builds,
 * o la URL de Expo Go mientras se desarrolla. Cualquier otra cosa se ignora
 * para que /api/mobile/return no sirva de redirección abierta.
 */
export function appReturnBase(value: unknown) {
  if (typeof value === "string" && /^(catarinamarket:\/\/|exp:\/\/[\w.-]+(:\d+)?\/--\/)$/.test(value)) return value;
  return "catarinamarket://";
}

/** ¿El usuario es el cliente, el dueño del negocio o el repartidor del pedido? */
export async function isOrderParticipant(orderId: string, userId: string) {
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("customer_id, business:businesses(owner_id), shipments(courier_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  const business = order.business as unknown as { owner_id: string } | null;
  const shipments = (order.shipments ?? []) as { courier_id: string | null }[];
  return order.customer_id === userId || business?.owner_id === userId || shipments.some((s) => s.courier_id === userId);
}
