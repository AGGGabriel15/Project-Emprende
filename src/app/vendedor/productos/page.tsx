import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductsTable } from "@/components/vendor/products-table";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductCategory } from "@/types/domain";

export const metadata: Metadata = { title: "Productos" };

export default async function VendorProductsPage() {
  const { business } = await requireApprovedBusiness("/vendedor/productos");
  const supabase = await createClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("product_categories").select("*").eq("business_id", business.id).order("sort_order"),
  ]);

  return (
    <>
      <PageHeader
        title="Productos"
        description="Precio, stock y visibilidad de tu catálogo. Tus primeros productos los revisa la administración antes de publicarse (normalmente en menos de 24 h)."
        action={
          <Button asChild>
            <Link href="/vendedor/productos/nuevo">
              <Plus /> Nuevo producto
            </Link>
          </Button>
        }
      />
      {products?.length ? (
        <ProductsTable products={products as Product[]} categories={(categories ?? []) as ProductCategory[]} />
      ) : (
        <EmptyState
          icon={<Package />}
          title="Aún no tienes productos"
          description="Agrega tu primer producto con fotos, precio y stock."
          action={
            <Button asChild>
              <Link href="/vendedor/productos/nuevo">
                <Plus /> Crear producto
              </Link>
            </Button>
          }
        />
      )}
    </>
  );
}
