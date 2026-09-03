"use client";

import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useCart } from "@/store/cart";

export function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const total = items.reduce(
    (sum, item) => sum + item.priceMinor * item.quantity,
    0,
  );
  if (!items.length)
    return (
      <div className="rounded-[2rem] border border-dashed bg-white p-12 text-center">
        <ShoppingBasket className="mx-auto mb-4 text-[#236b4e]" size={36} />
        <h2 className="text-3xl">Tu carrito está vacío</h2>
        <p className="mt-2 text-[#65736b]">
          Explora el catálogo y apoya a un emprendimiento local.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        {items.map((item) => (
          <article
            key={item.productId}
            className="flex gap-4 rounded-2xl border bg-white p-4"
          >
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[#e8efe8]">
              {item.image ? (
                <Image src={item.image} alt="" fill className="object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-3xl">
                  🌿
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#75837b] uppercase">
                {item.businessName}
              </p>
              <h3 className="truncate text-xl font-bold">{item.name}</h3>
              <p className="mt-1 font-bold text-[#236b4e]">
                {formatMoney(item.priceMinor)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center rounded-full border">
                  <button
                    className="grid size-8 place-items-center"
                    onClick={() =>
                      setQuantity(item.productId, item.quantity - 1)
                    }
                    aria-label="Reducir"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    className="grid size-8 place-items-center"
                    onClick={() =>
                      setQuantity(item.productId, item.quantity + 1)
                    }
                    aria-label="Aumentar"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => remove(item.productId)}
                  className="text-red-700"
                  aria-label="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <aside className="h-fit rounded-[2rem] bg-[#173e30] p-7 text-white lg:sticky lg:top-28">
        <h2 className="text-2xl font-bold">Resumen</h2>
        <p className="mt-2 text-sm text-[#c9d9cf]">
          Pedido a {items[0].businessName}
        </p>
        <div className="my-6 space-y-3 border-y border-white/15 py-5 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Entrega</span>
            <strong>Sin costo</strong>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span>Total</span>
          <strong className="font-serif text-3xl">{formatMoney(total)}</strong>
        </div>
        <Button
          asChild
          className="mt-7 w-full bg-[#e89c3f] text-[#183127] hover:bg-[#f1af5d]"
        >
          <Link href="/checkout">Continuar al pago</Link>
        </Button>
      </aside>
    </div>
  );
}
