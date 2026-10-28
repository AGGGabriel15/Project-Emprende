"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  name: string;
  priceMinor: number;
  image?: string;
  stock: number;
  quantity: number;
  note?: string;
};

export type CartGroup = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  items: CartItem[];
  subtotal: number;
  count: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setNote: (productId: string, note: string) => void;
  remove: (productId: string) => void;
  clearBusiness: (businessId: string) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
};

const clamp = (value: number, max: number) =>
  Math.max(1, Math.min(Math.max(max, 1), 99, value));

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, quantity = 1) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId
                ? { ...i, ...item, quantity: clamp(i.quantity + quantity, item.stock) }
                : i,
            ),
          });
          return;
        }
        set({ items: [...get().items, { ...item, quantity: clamp(quantity, item.stock) }] });
      },
      setQuantity: (productId, quantity) =>
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity: clamp(quantity, i.stock) } : i,
          ),
        }),
      setNote: (productId, note) =>
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, note: note.slice(0, 200) || undefined } : i,
          ),
        }),
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      clearBusiness: (businessId) =>
        set({ items: get().items.filter((i) => i.businessId !== businessId) }),
      replace: (items) => set({ items }),
      clear: () => set({ items: [] }),
    }),
    { name: "cm-cart", version: 2 },
  ),
);

/** Agrupa los items por negocio: un grupo = un pedido = un pago. */
export function groupByBusiness(items: CartItem[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const group = groups.get(item.businessId) ?? {
      businessId: item.businessId,
      businessName: item.businessName,
      businessSlug: item.businessSlug,
      items: [],
      subtotal: 0,
      count: 0,
    };
    group.items.push(item);
    group.subtotal += item.priceMinor * item.quantity;
    group.count += item.quantity;
    groups.set(item.businessId, group);
  }
  return [...groups.values()];
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
