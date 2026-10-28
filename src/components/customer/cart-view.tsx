"use client";

import { ArrowRight, Info, ShoppingBag, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { QuantityStepper } from "@/components/catalog/add-to-cart";
import { ProductImage } from "@/components/catalog/product-image";
import { useCartHydrated } from "@/components/layout/cart-button";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/card";
import { cartCount, groupByBusiness, useCart } from "@/features/cart/store";
import { formatMoney } from "@/lib/utils";

export function CartView() {
  const hydrated = useCartHydrated();
  const items = useCart((state) => state.items);
  const { setQuantity, remove, setNote, clearBusiness } = useCart.getState();

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title="Tu carrito está vacío"
        description="Explora los negocios de Catarina y agrega lo que te guste. Puedes comprar a varios negocios a la vez."
        action={
          <Button asChild>
            <Link href="/buscar">Explorar productos</Link>
          </Button>
        }
      />
    );
  }

  const groups = groupByBusiness(items);

  return (
    <>
      <PageHeader
        title="Carrito"
        description={`${cartCount(items)} productos de ${groups.length} ${groups.length === 1 ? "negocio" : "negocios"}`}
      />
      {groups.length > 1 && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl bg-info-soft p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          Cada negocio prepara y envía su propio pedido, así que pagas cada uno por separado.
        </p>
      )}
      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group.businessId} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-5 py-3">
              <Link href={`/negocios/${group.businessSlug}`} className="flex min-w-0 items-center gap-2 font-semibold hover:text-primary">
                <Store className="size-4 shrink-0 text-primary" />
                <span className="truncate">{group.businessName}</span>
              </Link>
              <button
                type="button"
                onClick={() => confirm(`¿Vaciar el carrito de ${group.businessName}?`) && clearBusiness(group.businessId)}
                className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-destructive"
              >
                Vaciar
              </button>
            </div>
            <ul className="divide-y">
              {group.items.map((item) => (
                <li key={item.productId} className="flex gap-4 p-4 sm:p-5">
                  <Link href={`/productos/${item.productId}`} className="shrink-0">
                    <ProductImage src={item.image} alt={item.name} className="size-20 rounded-xl sm:size-24" sizes="96px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/productos/${item.productId}`} className="line-clamp-2 font-medium hover:text-primary">
                        {item.name}
                      </Link>
                      <p className="shrink-0 font-semibold tabular-nums">{formatMoney(item.priceMinor * item.quantity)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatMoney(item.priceMinor)} c/u</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={Math.max(item.stock, 1)}
                        onChange={(value) => setQuantity(item.productId, value)}
                      />
                      <button
                        type="button"
                        onClick={() => remove(item.productId)}
                        className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" /> Quitar
                      </button>
                    </div>
                    <input
                      defaultValue={item.note ?? ""}
                      onBlur={(event) => setNote(item.productId, event.target.value)}
                      placeholder="Nota para el negocio (opcional)"
                      maxLength={200}
                      aria-label={`Nota para ${item.name}`}
                      className="mt-3 h-9 w-full rounded-lg border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal · el envío se calcula al pagar</p>
                <p className="text-xl font-semibold tabular-nums">{formatMoney(group.subtotal)}</p>
              </div>
              <Button asChild size="lg">
                <Link href={`/checkout/${group.businessId}`}>
                  Pagar este pedido <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
