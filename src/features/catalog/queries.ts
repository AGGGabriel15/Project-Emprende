import { createClient as createSupabase } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  businessOpenState,
  deliveryFor,
  type BusinessWithMeta,
  type Location,
  type ProductWithBusiness,
} from "@/features/catalog/meta";
import { createClient } from "@/lib/supabase/server";
import type {
  PlatformCategory,
  PlatformZone,
  Product,
  ProductCategory,
  Review,
} from "@/types/domain";

export type { BusinessWithMeta, Location, ProductWithBusiness };

const BUSINESS_META =
  "*, category:platform_categories(name, slug, icon), business_hours(*), business_closures(date, reason)";

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
}

/** Tarifas de envío de la plataforma (caché corta; /admin/zonas la invalida). */
export const getPlatformZones = unstable_cache(
  async (): Promise<PlatformZone[]> => {
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase.from("platform_delivery_zones").select("*").eq("is_active", true);
    return (data ?? []) as PlatformZone[];
  },
  ["platform-zones-v1"],
  { revalidate: 300, tags: ["platform-zones"] },
);

/** Métricas públicas del negocio (transparencia). */
export const getBusinessStats = cache(async (businessId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_public_stats", { p_business: businessId }).maybeSingle<{
    completed_orders: number;
    on_time_rate: number | null;
    member_since: string | null;
  }>();
  return {
    completedOrders: data?.completed_orders ?? 0,
    onTimeRate: data?.on_time_rate == null ? null : Number(data.on_time_rate),
    memberSince: data?.member_since ?? null,
  };
});

export const listCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as PlatformCategory[];
});

export async function listBusinesses(options: {
  categoryId?: number;
  q?: string;
  openNow?: boolean;
  location?: Location;
  deliversOnly?: boolean;
  limit?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("businesses")
    .select(BUSINESS_META)
    .eq("status", "approved")
    .gte("business_closures.date", todayIso())
    .order("rating_avg", { ascending: false })
    .limit(options.limit ?? 60);
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.q) query = query.ilike("trade_name", `%${sanitize(options.q)}%`);
  const { data } = await query;
  let businesses = (data ?? []) as BusinessWithMeta[];
  if (options.openNow) businesses = businesses.filter((b) => businessOpenState(b).open);
  if (options.deliversOnly && !deliveryFor(await getPlatformZones(), options.location ?? null)) {
    businesses = [];
  }
  return businesses;
}

export const getBusinessBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select(BUSINESS_META)
    .eq("slug", slug)
    .gte("business_closures.date", todayIso())
    .maybeSingle();
  if (!data) return null;
  const business = data as BusinessWithMeta;
  const [products, categories, reviews] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .eq("review_status", "approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("product_categories")
      .select("*")
      .eq("business_id", business.id)
      .order("sort_order"),
    supabase
      .from("reviews")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  return {
    business,
    products: (products.data ?? []) as Product[],
    categories: (categories.data ?? []) as ProductCategory[],
    reviews: await withReviewAuthors(supabase, (reviews.data ?? []) as Review[]),
  };
});

/** Adjunta nombre corto y foto de quien reseñó (profiles no es público). */
export async function withReviewAuthors(supabase: Awaited<ReturnType<typeof createClient>>, reviews: Review[]) {
  if (reviews.length === 0) return reviews;
  const { data } = await supabase.rpc("review_authors", { p_ids: [...new Set(reviews.map((r) => r.customer_id))] });
  const authors = new Map(((data ?? []) as { id: string; name: string; avatar_url: string | null }[]).map((a) => [a.id, a]));
  return reviews.map((r) => ({ ...r, author: authors.get(r.customer_id) ?? null }));
}

export const getProduct = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(`*, business:businesses(${BUSINESS_META}), category:product_categories(name)`)
    .eq("id", id)
    .gte("business.business_closures.date", todayIso())
    .maybeSingle();
  if (!data || !data.business || data.business.status !== "approved" || !data.is_active || data.review_status !== "approved") {
    return null;
  }
  return data as ProductWithBusiness & { category: { name: string } | null };
});

export async function searchProducts(options: {
  q?: string;
  categoryId?: number;
  openNow?: boolean;
  sort?: "recent" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(`*, business:businesses!inner(${BUSINESS_META})`, { count: "exact" })
    .eq("is_active", true)
    .eq("review_status", "approved")
    .eq("business.status", "approved")
    .gte("business.business_closures.date", todayIso());
  if (options.q) {
    const q = sanitize(options.q);
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,material.ilike.%${q}%`);
  }
  if (options.categoryId) query = query.eq("business.category_id", options.categoryId);
  if (options.sort === "price_asc") query = query.order("price_minor", { ascending: true });
  else if (options.sort === "price_desc") query = query.order("price_minor", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const limit = options.limit ?? 24;
  const offset = options.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;
  let products = (data ?? []) as ProductWithBusiness[];
  if (options.openNow) products = products.filter((p) => businessOpenState(p.business).open);
  return { products, total: count ?? 0 };
}

/** Quita caracteres con significado en los filtros de PostgREST. */
function sanitize(value: string) {
  return value.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
}
