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
 * El carrito local pertenece a una sola cuenta:
 * - visitante que inicia sesión: su carrito se combina con el guardado;
 * - otra cuenta en el mismo navegador: se reemplaza por el guardado de la nueva;
 * - sin sesión (o cuenta que no compra): se vacía el carrito de la cuenta anterior.
 * Con sesión, cada cambio se sube a Supabase con un pequeño retraso.
 */
export function CartSync({ userId }: { userId: string | null }) {
  const ready = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    let started = false;
    const start = async () => {
      if (started) return;
      started = true;
      const { ownerId, setOwner } = useCart.getState();
      if (!userId) {
        if (ownerId) setOwner(null, []);
        return;
      }
      const remote = await getServerCart();
      if (cancelled) return;
      const { items: local, ownerId: owner } = useCart.getState();
      // Mismo usuario o visitante: se combinan; carrito de otra cuenta: se descarta.
      setOwner(userId, owner === userId || owner === null ? merge(local, remote) : remote);
      ready.current = true;
      void saveServerCart(toPayload(useCart.getState().items));
      unsubscribe = useCart.subscribe((state, previous) => {
        if (!ready.current || state.items === previous.items || state.ownerId !== userId) return;
        clearTimeout(timer);
        timer = setTimeout(() => void saveServerCart(toPayload(state.items)), 800);
      });
    };

    if (useCart.persist.hasHydrated()) void start();
    const unsubHydration = useCart.persist.onFinishHydration(() => void start());

    return () => {
      cancelled = true;
      ready.current = false;
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
