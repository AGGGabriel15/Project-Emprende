import { notFound } from "next/navigation";
import { ProductCard } from "@/components/products/product-card";
import { serverApi } from "@/lib/server-api";
import type { ProductView } from "@/types/domain";

export const dynamic = "force-dynamic";
const names: Record<
  string,
  { name: string; icon: string; description: string }
> = {
  artesanias: {
    name: "Artesanías",
    icon: "🧺",
    description: "Piezas con identidad, creadas a mano por talento local.",
  },
  plantas: {
    name: "Plantas",
    icon: "🌱",
    description: "Vida y color cultivados en la tierra fértil de Catarina.",
  },
  comida: {
    name: "Comida",
    icon: "🍯",
    description:
      "Recetas, ingredientes y sabores que cuentan nuestra historia.",
  },
};

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = names[slug];
  if (!category) notFound();
  const products =
    (await serverApi<ProductView[]>(
      `/api/productos?categoria=${slug}&limit=48`,
    )) ?? [];
  return (
    <div className="container-page py-12">
      <div className="rounded-[2rem] bg-[#e8efe8] p-8 sm:p-12">
        <span className="text-5xl">{category.icon}</span>
        <h1 className="mt-5 text-5xl font-bold">{category.name}</h1>
        <p className="mt-3 max-w-xl text-[#65736b]">{category.description}</p>
      </div>
      <div className="mt-10">
        {products.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-white p-10 text-center text-[#65736b]">
            Todavía no hay productos en esta categoría.
          </p>
        )}
      </div>
    </div>
  );
}
