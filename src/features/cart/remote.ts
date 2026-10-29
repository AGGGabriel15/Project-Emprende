import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CartItem } from "./store";

/**
 * Carrito guardado en Supabase (carts + cart_items), compartido por las Server
 * Actions del web y la app móvil: recibe el cliente del usuario (RLS).
 */

const syncSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      businessId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
      note: z.string().max(200).optional(),
    }),
  )
  .max(100);

/** Carrito guardado del usuario (carts + cart_items), con datos actuales del producto. */
export async function loadCart(supabase: SupabaseClient, userId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from("carts")
    .select(
      "business:businesses(id, trade_name, slug, status), items:cart_items(quantity, note, product:products(id, name, price_minor, images, stock, is_active))",
    )
    .eq("user_id", userId);
  const items: CartItem[] = [];
  for (const cart of data ?? []) {
    const business = cart.business as unknown as { id: string; trade_name: string; slug: string; status: string } | null;
    if (!business || business.status !== "approved") continue;
    for (const line of (cart.items ?? []) as unknown as {
      quantity: number;
      note: string | null;
      product: { id: string; name: string; price_minor: number; images: string[]; stock: number; is_active: boolean } | null;
    }[]) {
      if (!line.product?.is_active) continue;
      items.push({
        productId: line.product.id,
        businessId: business.id,
        businessName: business.trade_name,
        businessSlug: business.slug,
        name: line.product.name,
        priceMinor: line.product.price_minor,
        image: line.product.images[0],
        stock: line.product.stock,
        quantity: line.quantity,
        note: line.note ?? undefined,
      });
    }
  }
  return items;
}

/** Reemplaza el carrito guardado por el del navegador. */
export async function saveCart(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) return;

  const businessIds = [...new Set(parsed.data.map((i) => i.businessId))];
  // Carritos de negocios que ya no tienen items.
  const { data: existing } = await supabase.from("carts").select("id, business_id").eq("user_id", userId);
  const stale = (existing ?? []).filter((c) => !businessIds.includes(c.business_id)).map((c) => c.id);
  if (stale.length) await supabase.from("carts").delete().in("id", stale);
  if (!businessIds.length) return;

  const { data: carts } = await supabase
    .from("carts")
    .upsert(
      businessIds.map((business_id) => ({ user_id: userId, business_id, updated_at: new Date().toISOString() })),
      { onConflict: "user_id,business_id" },
    )
    .select("id, business_id");
  const cartByBusiness = new Map((carts ?? []).map((c) => [c.business_id, c.id]));
  const cartIds = [...cartByBusiness.values()];
  await supabase.from("cart_items").delete().in("cart_id", cartIds);
  await supabase.from("cart_items").insert(
    parsed.data
      .filter((i) => cartByBusiness.has(i.businessId))
      .map((i) => ({
        cart_id: cartByBusiness.get(i.businessId),
        product_id: i.productId,
        quantity: i.quantity,
        note: i.note ?? null,
      })),
  );
}
