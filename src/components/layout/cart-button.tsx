"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cartCount, useCart } from "@/features/cart/store";

const subscribe = (callback: () => void) => useCart.persist.onFinishHydration(callback);

export function useCartHydrated() {
  return useSyncExternalStore(subscribe, () => useCart.persist.hasHydrated(), () => false);
}

export function CartButton() {
  const count = useCart((state) => cartCount(state.items));
  const hydrated = useCartHydrated();
  return (
    <Link
      href="/carrito"
      className="relative hidden size-10 place-items-center rounded-full transition hover:bg-muted md:grid"
      aria-label={`Carrito, ${hydrated ? count : 0} productos`}
    >
      <ShoppingBag className="size-5" />
      {hydrated && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] leading-5 font-bold text-primary-foreground ring-2 ring-background">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
