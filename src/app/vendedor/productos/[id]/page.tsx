import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/vendor/product-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductCategory } from "@/types/domain";

export const metadata: Metadata = { title: "Editar producto" };

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const { business } = await requireApprovedBusiness(`/vendedor/productos/${id}`);
  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("business_id", business.id).maybeSingle(),
    supabase.from("product_categories").select("*").eq("business_id", business.id).order("sort_order"),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title="Editar producto"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/productos/${id}`} target="_blank">
              <ExternalLink /> Ver en la tienda
            </Link>
          </Button>
        }
      />
      <ProductForm product={product as Product} categories={(categories ?? []) as ProductCategory[]} />
    </>
  );
}
