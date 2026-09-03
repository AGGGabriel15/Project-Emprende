"use client";

import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";
import { useCart } from "@/store/cart";
import type { ProductView } from "@/types/domain";

export function AddToCart({ product }: { product: ProductView }) {
  const add = useCart((state) => state.add);
  const hydrated = useHydrated();
  const onAdd = () => {
    const item = {
      productId: product.id,
      name: product.name,
      priceMinor: product.priceMinor,
      stock: product.stock,
      image: product.images[0],
      entrepreneurId: product.entrepreneur.id,
      businessName: product.entrepreneur.businessName,
    };
    if (
      !add(item) &&
      window.confirm(
        "El carrito pertenece a otro emprendedor. ¿Deseas reemplazarlo?",
      )
    )
      add(item, true);
  };
  return (
    <Button size="lg" onClick={onAdd} disabled={!hydrated || product.stock < 1}>
      <ShoppingBasket size={19} />
      {product.stock ? "Agregar al carrito" : "Producto agotado"}
    </Button>
  );
}
