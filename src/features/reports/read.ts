import type { SupabaseClient } from "@supabase/supabase-js";
import { periodRange, startOfLocalDayUtc, type ReportOrder } from "./compute";

const FIELDS =
  "id, status, business_id, subtotal_minor, delivery_fee_minor, commission_amount_minor, total_minor, vendor_net_minor, paid_at, created_at";

/** Pedidos pagados en el período (RLS: el vendedor solo ve los suyos, el admin todos). */
type ReportOptions = { period?: string; businessId?: string; withItems?: boolean };

/** Pedidos pagados del período (compartido por el web y la app móvil; RLS decide qué ve cada quien). */
export async function reportOrdersWith(supabase: SupabaseClient, options: ReportOptions) {
  const range = periodRange(options.period ?? "30d");
  let query = supabase
    .from("orders")
    .select(options.withItems ? `${FIELDS}, items:order_items(product_id, product_name, quantity, subtotal_minor)` : FIELDS)
    .not("paid_at", "is", null)
    .gte("paid_at", startOfLocalDayUtc(range.from))
    .order("paid_at", { ascending: true })
    .limit(5000);
  if (options.businessId) query = query.eq("business_id", options.businessId);
  const { data } = await query;
  return { orders: (data ?? []) as unknown as ReportOrder[], range };
}

export function seriesLabel(key: string, granularity: "day" | "week" | "month") {
  const date = new Date(`${key.length === 7 ? `${key}-01` : key}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-NI", {
    timeZone: "UTC",
    ...(granularity === "month" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" }),
  }).format(date);
}
