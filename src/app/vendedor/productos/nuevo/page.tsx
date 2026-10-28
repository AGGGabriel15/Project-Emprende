import type { Metadata } from "next";
import { ProductForm } from "@/components/vendor/product-form";
import { PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategory } from "@/types/domain";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { business } = await requireApprovedBusiness("/vendedor/productos/nuevo");
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("product_categories")
    .select("*")
    .eq("business_id", business.id)
    .order("sort_order");
  return (
    <>
      <PageHeader title="Nuevo producto" />
      <ProductForm categories={(categories ?? []) as ProductCategory[]} />
    </>
  );
}
