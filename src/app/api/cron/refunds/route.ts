import { NextResponse } from "next/server";
import { processPendingRefunds } from "@/features/orders/server";

/**
 * Procesa los reembolsos que dejó en cola la base (cancelaciones por plazo,
 * retiros vencidos, reclamos…). Llamar desde un cron externo con
 * `Authorization: Bearer $CRON_SECRET`. En Vercel lo llama el cron de vercel.json
 * (diario en el plan Hobby; Vercel envía el encabezado solo si CRON_SECRET existe).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await processPendingRefunds());
}
