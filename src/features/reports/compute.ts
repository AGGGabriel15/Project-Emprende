import type { Order, OrderItem, OrderStatus } from "@/types/domain";

export type ReportOrder = Pick<
  Order,
  | "id"
  | "status"
  | "business_id"
  | "subtotal_minor"
  | "delivery_fee_minor"
  | "commission_amount_minor"
  | "total_minor"
  | "vendor_net_minor"
  | "paid_at"
  | "created_at"
> & { items?: Pick<OrderItem, "product_id" | "product_name" | "quantity" | "subtotal_minor">[] };

export type Granularity = "day" | "week" | "month";

const SOLD: OrderStatus[] = ["preparing", "ready_for_pickup", "on_the_way", "completed"];
const LOST: OrderStatus[] = ["cancelled", "refunded"];

/** Fecha local (Managua) YYYY-MM-DD. */
export function localDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date(value));
}

function bucketKey(date: string, granularity: Granularity) {
  if (granularity === "month") return date.slice(0, 7);
  if (granularity === "week") {
    const d = new Date(`${date}T12:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7; // lunes = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  return date;
}

/** Métricas de pedidos pagados (paid_at no nulo). Cancelados/reembolsados no cuentan como venta. */
export function summarize(orders: ReportOrder[]) {
  const paid = orders.filter((o) => o.paid_at);
  const sold = paid.filter((o) => SOLD.includes(o.status));
  const lost = paid.filter((o) => LOST.includes(o.status));
  const gross = sold.reduce((s, o) => s + o.subtotal_minor, 0);
  const delivery = sold.reduce((s, o) => s + o.delivery_fee_minor, 0);
  const commission = sold.reduce((s, o) => s + o.commission_amount_minor, 0);
  const net = sold.reduce((s, o) => s + o.vendor_net_minor, 0);
  const total = sold.reduce((s, o) => s + o.total_minor, 0);
  return {
    orders: sold.length,
    gross,
    delivery,
    commission,
    net,
    total,
    avgTicket: sold.length ? Math.round(total / sold.length) : 0,
    cancelled: lost.length,
    cancellationRate: paid.length ? lost.length / paid.length : 0,
  };
}

/** Serie de ventas (subtotal) por día/semana/mes, con huecos en cero. */
export function salesSeries(orders: ReportOrder[], from: string, to: string, granularity: Granularity) {
  const buckets = new Map<string, { sales: number; orders: number }>();
  for (let d = from; d <= to; ) {
    buckets.set(bucketKey(d, granularity), { sales: 0, orders: 0 });
    const next = new Date(`${d}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }
  for (const order of orders) {
    if (!order.paid_at || !SOLD.includes(order.status)) continue;
    const key = bucketKey(localDate(order.paid_at), granularity);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.sales += order.subtotal_minor;
    bucket.orders += 1;
  }
  return [...buckets.entries()].map(([key, value]) => ({ key, ...value }));
}

export function topProducts(orders: ReportOrder[], limit = 5) {
  const totals = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    if (!order.paid_at || !SOLD.includes(order.status)) continue;
    for (const item of order.items ?? []) {
      const key = item.product_id ?? item.product_name;
      const current = totals.get(key) ?? { name: item.product_name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.subtotal_minor;
      totals.set(key, current);
    }
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function countByStatus(orders: Pick<Order, "status">[]) {
  const counts = {} as Record<OrderStatus, number>;
  for (const order of orders) counts[order.status] = (counts[order.status] ?? 0) + 1;
  return counts;
}

/** Rango [desde, hasta] en días locales para un período predefinido. */
export function periodRange(period: string, today = localDate(new Date())) {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;
  const from = new Date(`${today}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const granularity: Granularity = days <= 31 ? "day" : days <= 90 ? "week" : "month";
  return { from: from.toISOString().slice(0, 10), to: today, granularity, days };
}

/** Límite inferior en UTC para filtrar paid_at desde el inicio del día local (Managua = UTC-6). */
export function startOfLocalDayUtc(date: string) {
  return `${date}T06:00:00.000Z`;
}
