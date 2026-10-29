import { createClient } from "@/lib/supabase/server";
import { reportOrdersWith } from "./read";

export { seriesLabel } from "./read";

export async function reportOrders(options: { period?: string; businessId?: string; withItems?: boolean }) {
  return reportOrdersWith(await createClient(), options);
}
