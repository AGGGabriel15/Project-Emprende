import { useQuery } from '@tanstack/react-query';
import { localNow } from '@/features/businesses/hours';
import { businessOpenState, type BusinessWithMeta, type ProductWithBusiness } from '@/features/catalog/meta';
import type { PlatformCategory, PlatformZone, Product, ProductCategory, Review } from '@/types/domain';
import { supabase } from '~/lib/supabase';

/** Mismas consultas que src/features/catalog/queries.ts del web, con el cliente de la app. */

const BUSINESS_META = '*, category:platform_categories(name, slug, icon), business_hours(*), business_closures(date, reason)';

const today = () => localNow().date;

/** Quita caracteres con significado en los filtros de PostgREST. */
function sanitize(value: string) {
  return value.replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('platform_categories').select('*').eq('is_active', true).order('sort_order');
      return (data ?? []) as PlatformCategory[];
    },
  });
}

export function usePlatformZones() {
  return useQuery({
    queryKey: ['platform-zones'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('platform_delivery_zones').select('*').eq('is_active', true);
      return (data ?? []) as PlatformZone[];
    },
  });
}

export function useBusinesses(options: { categoryId?: number; q?: string; openNow?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ['businesses', options],
    queryFn: async () => {
      let query = supabase
        .from('businesses')
        .select(BUSINESS_META)
        .eq('status', 'approved')
        .gte('business_closures.date', today())
        .order('rating_avg', { ascending: false })
        .limit(options.limit ?? 60);
      if (options.categoryId) query = query.eq('category_id', options.categoryId);
      if (options.q) query = query.ilike('trade_name', `%${sanitize(options.q)}%`);
      const { data } = await query;
      const businesses = (data ?? []) as BusinessWithMeta[];
      return options.openNow ? businesses.filter((b) => businessOpenState(b).open) : businesses;
    },
  });
}

export type ReviewWithAuthor = Review & { author?: { id: string; name: string; avatar_url: string | null } | null };

/** Nombre corto y foto de quien reseñó (profiles no es público). */
export async function withReviewAuthors(reviews: Review[]): Promise<ReviewWithAuthor[]> {
  if (reviews.length === 0) return reviews as ReviewWithAuthor[];
  const { data } = await supabase.rpc('review_authors', { p_ids: [...new Set(reviews.map((r) => r.customer_id))] });
  const authors = new Map(((data ?? []) as { id: string; name: string; avatar_url: string | null }[]).map((a) => [a.id, a]));
  return reviews.map((r) => ({ ...r, author: authors.get(r.customer_id) ?? null }));
}

export function useBusiness(slug: string) {
  return useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select(BUSINESS_META).eq('slug', slug).gte('business_closures.date', today()).maybeSingle();
      if (!data) return null;
      const business = data as BusinessWithMeta;
      const [products, categories, reviews, stats] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .eq('review_status', 'approved')
          .order('created_at', { ascending: false }),
        supabase.from('product_categories').select('*').eq('business_id', business.id).order('sort_order'),
        supabase.from('reviews').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(6),
        supabase
          .rpc('business_public_stats', { p_business: business.id })
          .maybeSingle<{ completed_orders: number; on_time_rate: number | null; member_since: string | null }>(),
      ]);
      return {
        business,
        products: (products.data ?? []) as Product[],
        categories: (categories.data ?? []) as ProductCategory[],
        reviews: await withReviewAuthors((reviews.data ?? []) as Review[]),
        stats: {
          completedOrders: stats.data?.completed_orders ?? 0,
          onTimeRate: stats.data?.on_time_rate == null ? null : Number(stats.data.on_time_rate),
          memberSince: stats.data?.member_since ?? null,
        },
      };
    },
  });
}

export type ProductDetail = ProductWithBusiness & { category: { name: string } | null };

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data } = await supabase
        .from('products')
        .select(`*, business:businesses(${BUSINESS_META}), category:product_categories(name)`)
        .eq('id', id)
        .gte('business.business_closures.date', today())
        .maybeSingle();
      if (!data || !data.business || data.business.status !== 'approved' || !data.is_active || data.review_status !== 'approved') return null;
      return data as ProductDetail;
    },
  });
}

export type ProductSort = 'recent' | 'price_asc' | 'price_desc';

export function useProductSearch(options: { q?: string; categoryId?: number; openNow?: boolean; sort?: ProductSort; limit?: number }) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`*, business:businesses!inner(${BUSINESS_META})`, { count: 'exact' })
        .eq('is_active', true)
        .eq('review_status', 'approved')
        .eq('business.status', 'approved')
        .gte('business.business_closures.date', today());
      if (options.q) {
        const q = sanitize(options.q);
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,material.ilike.%${q}%`);
      }
      if (options.categoryId) query = query.eq('business.category_id', options.categoryId);
      if (options.sort === 'price_asc') query = query.order('price_minor', { ascending: true });
      else if (options.sort === 'price_desc') query = query.order('price_minor', { ascending: false });
      else query = query.order('created_at', { ascending: false });
      const { data, count } = await query.range(0, (options.limit ?? 40) - 1);
      let products = (data ?? []) as ProductWithBusiness[];
      if (options.openNow) products = products.filter((p) => businessOpenState(p.business).open);
      return { products, total: count ?? 0 };
    },
  });
}
