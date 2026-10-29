import { useEffect } from 'react';
import { loadCart, saveCart } from '@/features/cart/remote';
import { cartPayload, mergeCarts, useCart } from '@/features/cart/store';
import { supabase } from '~/lib/supabase';

/**
 * Igual que CartSync del web: el carrito local es de una sola cuenta. Al entrar
 * se combina con el guardado en Supabase, y cada cambio se sube con retraso,
 * así el carrito es el mismo en la app y en el web.
 */
export function CartSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    let cancelled = false;
    let ready = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      if (started) return;
      started = true;
      const { ownerId, setOwner } = useCart.getState();
      if (!userId) {
        if (ownerId) setOwner(null, []);
        return;
      }
      const remote = await loadCart(supabase, userId);
      if (cancelled) return;
      const { items: local, ownerId: owner } = useCart.getState();
      setOwner(userId, owner === userId || owner === null ? mergeCarts(local, remote) : remote);
      ready = true;
      void saveCart(supabase, userId, cartPayload(useCart.getState().items));
      unsubscribe = useCart.subscribe((state, previous) => {
        if (!ready || state.items === previous.items || state.ownerId !== userId) return;
        clearTimeout(timer);
        timer = setTimeout(() => void saveCart(supabase, userId, cartPayload(state.items)), 800);
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
