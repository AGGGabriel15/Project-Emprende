import type { Metadata } from "next";
import { CategoriesManager } from "@/components/vendor/categories-manager";
import { PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategory } from "@/types/domain";

export const metadata: Metadata = { title: "Categorías" };

export default async function VendorCategoriesPage() {
  const { business } = await requireApprovedBusiness("/vendedor/categorias");
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("product_categories").select("*").eq("business_id", business.id).order("sort_order"),
    supabase.from("products").select("category_id").eq("business_id", business.id),
  ]);
  const counts: Record<string, number> = {};
  for (const p of products ?? []) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Categorías de tu catálogo"
        description="Agrupan tus productos en tu página (p. ej. Alcancías, Jarrones, Maceteras). El orden aquí es el orden en la tienda."
      />
      <CategoriesManager categories={(categories ?? []) as ProductCategory[]} counts={counts} />
    </div>
  );
}
