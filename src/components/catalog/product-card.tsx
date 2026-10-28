import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  businessOpenState,
  type BusinessWithMeta,
} from "@/features/catalog/meta";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/types/domain";
import { AddToCartButton } from "./add-to-cart";
import { ProductImage } from "./product-image";

export function ProductCard({
  product,
  business,
  showBusiness = true,
}: {
  product: Product;
  business: BusinessWithMeta;
  showBusiness?: boolean;
}) {
  const soldOut = product.stock <= 0;
  const open = businessOpenState(business).open;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-(--radius-card) border bg-card transition hover:shadow-lg">
      <Link href={`/productos/${product.id}`} className="block">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          icon={business.category?.icon}
          className="aspect-square"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
          {soldOut && <Badge tone="red">Agotado</Badge>}
          {!soldOut && product.stock <= 3 && <Badge tone="amber">¡Quedan {product.stock}!</Badge>}
          {!open && <Badge tone="gray">Cerrado ahora</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-3.5">
        {showBusiness && (
          <Link
            href={`/negocios/${business.slug}`}
            className="truncate text-xs font-medium text-muted-foreground hover:text-primary"
          >
            {business.trade_name}
          </Link>
        )}
        <Link href={`/productos/${product.id}`} className="mt-0.5">
          <h3 className="line-clamp-2 font-sans text-sm leading-snug font-medium tracking-normal group-hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="font-semibold tabular-nums">{formatMoney(product.price_minor)}</p>
          <AddToCartButton
            compact
            disabled={soldOut}
            item={{
              productId: product.id,
              businessId: business.id,
              businessName: business.trade_name,
              businessSlug: business.slug,
              name: product.name,
              priceMinor: product.price_minor,
              image: product.images[0],
              stock: product.stock,
            }}
          />
        </div>
      </div>
    </article>
  );
}
