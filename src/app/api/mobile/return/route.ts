import { NextResponse } from "next/server";
import { appReturnBase } from "@/lib/mobile-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stripe vuelve aquí al pagar o cancelar desde la app; redirige al enlace de la
 * app (catarinamarket://pedidos/<id>) y el navegador integrado se cierra solo.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const order = params.get("pedido") ?? "";
  const status = params.get("estado") === "exito" ? "exito" : "cancelado";
  const base = appReturnBase(params.get("app"));
  const target = UUID.test(order) ? `${base}pedidos/${order}?pago=${status}` : `${base}pedidos`;
  return NextResponse.redirect(target, 302);
}
