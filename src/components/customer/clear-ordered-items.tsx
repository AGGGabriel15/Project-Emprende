"use client";

import { useEffect } from "react";
import { useCart } from "@/features/cart/store";

/** Al confirmarse el pago, quita del carrito local los productos del pedido. */
export function ClearOrderedItems({ productIds }: { productIds: string[] }) {
  const key = productIds.join(",");
  useEffect(() => {
    const remove = () => useCart.getState().removeProducts(key.split(","));
    if (useCart.persist.hasHydrated()) remove();
    return useCart.persist.onFinishHydration(remove);
  }, [key]);
  return null;
}
