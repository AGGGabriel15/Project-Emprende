"use server";

import { createClient } from "@/lib/supabase/server";
import { loadCart, saveCart } from "./remote";
import type { CartItem } from "./store";

/** Carrito guardado del usuario (carts + cart_items), con datos actuales del producto. */
export async function getServerCart(): Promise<CartItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? loadCart(supabase, user.id) : [];
}

/** Reemplaza el carrito guardado por el del navegador. */
export async function saveServerCart(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await saveCart(supabase, user.id, input);
}
