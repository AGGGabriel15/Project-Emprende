"use client";

import { useEffect, useRef } from "react";
import { getServerCart, saveServerCart } from "@/features/cart/actions";
import { cartPayload, mergeCarts, useCart } from "@/features/cart/store";

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
      setOwner(userId, owner === userId || owner === null ? mergeCarts(local, remote) : remote);
      ready.current = true;
      void saveServerCart(cartPayload(useCart.getState().items));
      unsubscribe = useCart.subscribe((state, previous) => {
        if (!ready.current || state.items === previous.items || state.ownerId !== userId) return;
        clearTimeout(timer);
        timer = setTimeout(() => void saveServerCart(cartPayload(state.items)), 800);
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
