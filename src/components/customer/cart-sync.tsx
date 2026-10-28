"use client";

import { useEffect, useRef } from "react";
import { getServerCart, saveServerCart } from "@/features/cart/actions";
import { useCart, type CartItem } from "@/features/cart/store";

function merge(local: CartItem[], remote: CartItem[]) {
  const map = new Map(remote.map((item) => [item.productId, item]));
  for (const item of local) {
    const saved = map.get(item.productId);
    map.set(item.productId, saved ? { ...saved, quantity: Math.min(Math.max(saved.quantity, item.quantity), saved.stock || 1) } : item);
  }
  return [...map.values()];
}

/**
 * Con sesión iniciada, el carrito persiste también en Supabase: al entrar se
 * combina con el guardado y cada cambio se sube con un pequeño retraso.
 */
export function CartSync({ userId }: { userId: string }) {
  const ready = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    let started = false;
    const start = async () => {
      if (started) return;
      started = true;
      const remote = await getServerCart();
      if (cancelled) return;
      const merged = merge(useCart.getState().items, remote);
      useCart.getState().replace(merged);
      ready.current = true;
      void saveServerCart(toPayload(merged));
      unsubscribe = useCart.subscribe((state, previous) => {
        if (!ready.current || state.items === previous.items) return;
        clearTimeout(timer);
        timer = setTimeout(() => void saveServerCart(toPayload(state.items)), 800);
      });
    };

    if (useCart.persist.hasHydrated()) void start();
    const unsubHydration = useCart.persist.onFinishHydration(() => void start());

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe?.();
      unsubHydration();
    };
  }, [userId]);

  return null;
}

function toPayload(items: CartItem[]) {
  return items.map(({ productId, businessId, quantity, note }) => ({ productId, businessId, quantity, note }));
}
