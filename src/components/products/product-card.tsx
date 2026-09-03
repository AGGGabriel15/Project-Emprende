"use client";

import { ShoppingBasket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";
import { formatMoney } from "@/lib/utils";
import { useCart } from "@/store/cart";
import type { ProductView } from "@/types/domain";

export function ProductCard({ product }: { product: ProductView }) {
  const add = useCart((state) => state.add);
  const hydrated = useHydrated();
  const addToCart = () => {
    const item = {
      productId: product.id,
      name: product.name,
      priceMinor: product.priceMinor,
      stock: product.stock,
      image: product.images[0],
      entrepreneurId: product.entrepreneur.id,
      businessName: product.entrepreneur.businessName,
    };
    if (!add(item)) {
      const replace = window.confirm(
        "Tu carrito contiene productos de otro emprendedor. ¿Deseas vaciarlo y agregar este producto?",
      );
      if (replace) add(item, true);
    }
  };

  return (
    <article className="group overflow-hidden rounded-3xl border bg-white shadow-[0_10px_30px_rgba(24,49,39,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(24,49,39,0.12)]">
      <Link href={`/productos/${product.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#e8efe8]">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div
              className="grid h-full place-items-center text-5xl"
              aria-hidden
            >
              🌿
            </div>
          )}
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#236b4e] backdrop-blur">
            {product.category.name}
          </span>
        </div>
      </Link>
      <div className="p-5">
        <Link
          href={`/productos?emprendedor=${product.entrepreneur.id}`}
          className="mb-1 block text-xs font-bold tracking-wide text-[#75837b] uppercase hover:text-[#236b4e]"
        >
          {product.entrepreneur.businessName}
        </Link>
        <Link href={`/productos/${product.id}`}>
          <h3 className="text-xl text-[#183127] hover:text-[#236b4e]">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#65736b]">
          {product.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-xl font-bold text-[#174936]">
              {formatMoney(product.priceMinor)}
            </p>
            <p className="text-xs text-[#75837b]">
              {product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={addToCart}
            disabled={!hydrated || product.stock < 1}
            aria-label={`Agregar ${product.name} al carrito`}
          >
            <ShoppingBasket size={16} /> Agregar
          </Button>
        </div>
      </div>
    </article>
  );
}
