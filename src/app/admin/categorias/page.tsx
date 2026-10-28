import type { Metadata } from "next";
import { PlatformCategoriesManager } from "@/components/admin/platform-categories";
import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { PlatformCategory } from "@/types/domain";

export const metadata: Metadata = { title: "Categorías globales" };

export default async function PlatformCategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_categories").select("*").order("sort_order");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Categorías globales" description="Clasifican a los negocios en el catálogo (filtros de inicio y búsqueda)." />
      <PlatformCategoriesManager categories={(data ?? []) as PlatformCategory[]} />
    </div>
  );
}
