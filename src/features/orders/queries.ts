import { createClient } from "@/lib/supabase/server";
import { getOrderDetailWith, listOrdersWith, type OrderFilter } from "./read";

export type { BoardOrder, OrderDetail, OrderFilter, OrderListItem } from "./read";

export async function listOrders(filter: OrderFilter) {
  return listOrdersWith(await createClient(), filter);
}

export async function getOrderDetail(id: string) {
  return getOrderDetailWith(await createClient(), id);
}
