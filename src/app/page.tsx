import { ArrowRight, HandHeart, Leaf, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/server-api";
import type { ProductView } from "@/types/domain";

export const dynamic = "force-dynamic";

const categories = [
  {
    slug: "artesanias",
    name: "Artesanías",
    icon: "🧺",
    copy: "Piezas que guardan tradición",
  },
  {
    slug: "plantas",
    name: "Plantas",
    icon: "🌱",
    copy: "Verde cultivado con cariño",
  },
  {
    slug: "comida",
    name: "Comida",
    icon: "🍯",
    copy: "Sabores nacidos en Catarina",
  },
];

export default async function Home() {
  const products =
    (await serverApi<ProductView[]>("/api/productos?limit=6")) ?? [];
  return (
    <>
      <section className="pattern-leaves overflow-hidden text-white">
        <div className="container-page grid min-h-[590px] items-center gap-12 py-16 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <p className="mb-5 text-sm font-bold tracking-[0.2em] text-[#f2bf7b] uppercase">
              Hecho en Catarina · Hecho con orgullo
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.03] font-bold sm:text-6xl lg:text-7xl">
              Lo nuestro encuentra un lugar en tu hogar.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#d9e7df]">
              Descubre productos auténticos y compra directamente a quienes
              mantienen viva la creatividad de nuestro municipio.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-[#e89c3f] text-[#183127] hover:bg-[#f1af5d]"
              >
                <Link href="/productos">
                  Explorar productos <ArrowRight size={18} />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/registro">Quiero vender</Link>
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap gap-6 text-sm text-[#d9e7df]">
              <span className="flex items-center gap-2">
                <MapPin size={17} className="text-[#f2bf7b]" /> Catarina, Masaya
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-[#f2bf7b]" /> Compra
                segura
              </span>
            </div>
          </div>
          <div className="relative hidden min-h-[440px] lg:block" aria-hidden>
            <div className="absolute inset-8 rotate-3 rounded-[4rem_2rem_5rem_2.5rem] bg-[#f2bf7b] opacity-90" />
            <div className="absolute inset-14 grid -rotate-2 place-items-center rounded-[3rem_5rem_2rem_4rem] border border-white/20 bg-[#f7ead0] text-[10rem] shadow-2xl">
              🌿
            </div>
            <div className="absolute right-2 bottom-8 rounded-2xl bg-white px-5 py-4 text-[#183127] shadow-xl">
              <p className="text-xs font-bold tracking-widest uppercase">
                Comunidad
              </p>
              <p className="font-serif text-2xl font-bold">Talento local</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="mb-9 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
              Encuentra lo que amas
            </p>
            <h2 className="mt-2 text-4xl font-bold">Explora por categoría</h2>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categorias/${category.slug}`}
              className="group flex min-h-44 items-end justify-between rounded-3xl border bg-[#f3eddd] p-7 transition hover:-translate-y-1 hover:border-[#9bb4a5]"
            >
              <div>
                <span className="text-4xl">{category.icon}</span>
                <h3 className="mt-5 text-2xl font-bold">{category.name}</h3>
                <p className="mt-1 text-sm text-[#65736b]">{category.copy}</p>
              </div>
              <ArrowRight className="transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#edf2eb] py-20">
        <div className="container-page">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
                Recién llegados
              </p>
              <h2 className="mt-2 text-4xl font-bold">
                Productos de nuestra gente
              </h2>
            </div>
            <Link
              href="/productos"
              className="flex items-center gap-2 font-bold text-[#236b4e]"
            >
              Ver todo <ArrowRight size={18} />
            </Link>
          </div>
          {products.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-white p-12 text-center">
              <Leaf className="mx-auto mb-4 text-[#236b4e]" />
              <h3 className="text-2xl">El catálogo está listo para crecer</h3>
              <p className="mt-2 text-[#65736b]">
                Inicia MongoDB y ejecuta el seed para ver los productos de
                demostración.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="container-page py-20">
        <div className="grid gap-6 rounded-[2rem] bg-[#fff1db] p-8 md:grid-cols-3 md:p-12">
          {[
            {
              icon: HandHeart,
              title: "Compra con propósito",
              text: "Cada pedido impulsa directamente un negocio local.",
            },
            {
              icon: Leaf,
              title: "Origen cercano",
              text: "Conoce quién creó o cultivó cada producto.",
            },
            {
              icon: ShieldCheck,
              title: "Proceso confiable",
              text: "Inventario, pago y seguimiento en un solo lugar.",
            },
          ].map((benefit) => (
            <div key={benefit.title}>
              <benefit.icon className="mb-4 text-[#c87724]" />
              <h3 className="text-xl font-bold">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#65736b]">
                {benefit.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
