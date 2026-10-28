import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  Review,
} from "@/types/domain";

export type BoardOrder = Order & { items: OrderItem[] };

export type OrderListItem = Order & {
  business: { trade_name: string; slug: string; logo_url: string | null };
  items: Pick<OrderItem, "product_name" | "quantity" | "image_url">[];
};

export type OrderDetail = Order & {
  business: { id: string; trade_name: string; slug: string; phone: string | null; whatsapp: string | null; address_line: string | null; logo_url: string | null };
  items: OrderItem[];
  history: OrderStatusHistory[];
  review: Review | null;
  refunds: { amount_minor: number; reason: string; created_at: string; provider_ref: string | null }[];
};

export async function listOrders(filter: { customerId?: string; businessId?: string; statuses?: OrderStatus[]; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, business:businesses(trade_name, slug, logo_url), items:order_items(product_name, quantity, image_url)")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.customerId) query = query.eq("customer_id", filter.customerId);
  if (filter.businessId) query = query.eq("business_id", filter.businessId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data } = await query;
  return (data ?? []) as OrderListItem[];
}

export async function getOrderDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "*, business:businesses(id, trade_name, slug, phone, whatsapp, address_line, logo_url), items:order_items(*), history:order_status_history(*), review:reviews(*), refunds(amount_minor, reason, created_at, provider_ref)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const order = data as unknown as OrderDetail & { review: Review[] | Review | null };
  return {
    ...order,
    review: Array.isArray(order.review) ? (order.review[0] ?? null) : order.review,
    history: [...order.history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  } as OrderDetail;
}
