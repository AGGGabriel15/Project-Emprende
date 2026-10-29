import { NextResponse } from "next/server";
import { buildPushMessages, staleTokens, type ExpoTicket } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo llama la base (trigger notifications_push vía pg_net) con el id de un
 * aviso nuevo. Solo envía avisos de los últimos 10 minutos que aún no se
 * enviaron, y los marca antes de mandarlos: repetir la llamada no reenvía.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id) return NextResponse.json({ error: "Aviso no válido." }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: notification } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", id)
    .is("pushed_at", null)
    .gte("created_at", since)
    .select("user_id, title, body, link")
    .maybeSingle();
  if (!notification) return NextResponse.json({ sent: 0 });

  const { data: rows } = await admin.from("push_tokens").select("token").eq("user_id", notification.user_id);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (!tokens.length) return NextResponse.json({ sent: 0 });

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(buildPushMessages(tokens, notification)),
  });
  const result = (await response.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
  const stale = staleTokens(tokens, result?.data ?? []);
  if (stale.length) await admin.from("push_tokens").delete().in("token", stale);
  if (!response.ok) console.error("[push]", response.status, JSON.stringify(result).slice(0, 300));
  return NextResponse.json({ sent: tokens.length - stale.length });
}
