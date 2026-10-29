import { Check, PackageCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, PromptActionButton } from "@/components/admin/action-buttons";
import { ProductImage } from "@/components/catalog/product-image";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { reviewProduct } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import { TIER_INFO } from "@/lib/validations/business";
import type { BusinessTier, Product } from "@/types/domain";

export const metadata: Metadata = { title: "Moderación de productos" };

type PendingProduct = Product & { business: { trade_name: string; slug: string; tier: BusinessTier } | null };

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, business:businesses(trade_name, slug, tier)")
    .eq("review_status", "pending")
    .order("created_at")
    .limit(100);
  const products = (data ?? []) as PendingProduct[];

  return (
    <>
      <PageHeader
        title="Moderación de productos"
        description="Los primeros productos de cada negocio se publican cuando los apruebas: revisa que las fotos sean reales, el precio razonable y la descripción honesta."
      />
      {products.length === 0 ? (
        <EmptyState icon={<PackageCheck />} title="No hay productos por revisar" />
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="flex gap-2">
                {(product.images.length ? product.images.slice(0, 3) : [undefined]).map((src, index) => (
                  <ProductImage key={src ?? index} src={src} alt="" className="size-24 shrink-0 rounded-xl" sizes="96px" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {product.name}
                  {product.business && (
                    <Badge tone={product.business.tier === "informal" ? "violet" : "brand"}>
                      {TIER_INFO[product.business.tier].label}
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {product.business?.trade_name} · {formatMoney(product.price_minor)} · stock {product.stock} ·{" "}
                  {formatDate(product.created_at)}
                </p>
                <p className="mt-2 line-clamp-3 text-sm">{product.description || "Sin descripción."}</p>
                {product.business && (
                  <Link href={`/negocios/${product.business.slug}`} className="mt-1 inline-block text-xs text-primary hover:underline">
                    Ver tienda
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <ActionButton size="sm" success="Producto publicado." action={reviewProduct.bind(null, product.id, true, undefined)}>
                  <Check /> Aprobar
                </ActionButton>
                <PromptActionButton
                  size="sm"
                  variant="outline"
                  title="Pedir correcciones"
                  description="El vendedor verá esta nota; al editar el producto vuelve a revisión."
                  label="¿Qué debe corregir?"
                  placeholder="Ej.: usa fotos reales del producto, no de internet"
                  confirmLabel="Enviar observación"
                  success="Observación enviada."
                  action={async (note: string) => {
                    "use server";
                    return reviewProduct(product.id, false, note);
                  }}
                >
                  <X /> Observar
                </PromptActionButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
