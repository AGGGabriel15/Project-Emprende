import type { Metadata } from "next";
import { MapPin, PackageCheck } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/products/add-to-cart";
import { serverApi } from "@/lib/server-api";
import { formatMoney } from "@/lib/utils";
import type { ProductView } from "@/types/domain";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await serverApi<ProductView>(`/api/productos/${id}`);
  return {
    title: product?.name ?? "Producto",
    description: product?.description,
  };
}

export default async function ProductDetail({ params }: { params: Params }) {
  const { id } = await params;
  const product = await serverApi<ProductView>(`/api/productos/${id}`);
  if (!product) notFound();
  return (
    <div className="container-page py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-[#e8efe8]">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="grid h-full place-items-center text-8xl">🌿</div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
            {product.category.name}
          </p>
          <h1 className="mt-3 text-5xl font-bold">{product.name}</h1>
          <p className="mt-5 text-lg leading-8 text-[#65736b]">
            {product.description}
          </p>
          <p className="mt-7 font-serif text-4xl font-bold text-[#174936]">
            {formatMoney(product.priceMinor)}
          </p>
          <div className="mt-7 flex flex-wrap gap-5 border-y py-5 text-sm text-[#4f6257]">
            <span className="flex items-center gap-2">
              <PackageCheck size={18} /> {product.stock} disponibles
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={18} /> {product.entrepreneur.businessName}
            </span>
          </div>
          <div className="mt-7">
            <AddToCart product={product} />
          </div>
          <p className="mt-4 text-xs text-[#75837b]">
            Coordina retiro o entrega local después de realizar tu pago.
          </p>
        </div>
      </div>
    </div>
  );
}
