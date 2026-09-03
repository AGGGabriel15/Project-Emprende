"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  priceMinor: number;
  quantity: number;
  stock: number;
  image?: string;
  entrepreneurId: string;
  businessName: string;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, replaceSeller?: boolean) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, replaceSeller = false) => {
        const current = get().items;
        const conflict =
          current.length > 0 &&
          current[0].entrepreneurId !== item.entrepreneurId;
        if (conflict && !replaceSeller) return false;
        const base = conflict ? [] : current;
        const existing = base.find(
          (entry) => entry.productId === item.productId,
        );
        const items = existing
          ? base.map((entry) =>
              entry.productId === item.productId
                ? {
                    ...entry,
                    quantity: Math.min(entry.stock, entry.quantity + 1),
                  }
                : entry,
            )
          : [...base, { ...item, quantity: 1 }];
        set({ items });
        return true;
      },
      setQuantity: (productId, quantity) =>
        set({
          items: get().items.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.max(1, Math.min(item.stock, quantity)),
                }
              : item,
          ),
        }),
      remove: (productId) =>
        set({
          items: get().items.filter((item) => item.productId !== productId),
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "euc-cart" },
  ),
);
