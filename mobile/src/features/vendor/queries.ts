import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardOrder } from '@/features/orders/read';
import { reportOrdersWith } from '@/features/reports/read';
import type {
  ActionResult,
  BankAccount,
  Business,
  BusinessClosure,
  BusinessDocument,
  BusinessHour,
  LedgerEntry,
  Payout,
  Product,
  ProductCategory,
  Review,
  Strike,
} from '@/types/domain';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { withReviewAuthors } from '~/features/catalog/queries';
import { supabase } from '~/lib/supabase';

/** Negocio de la persona (cualquier estado: borrador, pendiente, aprobado…). */
export function useMyBusiness() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['my-business', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('*').eq('owner_id', session!.user.id).maybeSingle();
      return (data as Business | null) ?? null;
    },
  });
}

export const isActiveBusiness = (b: Business | null | undefined) => !!b && ['approved', 'suspended'].includes(b.status);

const BOARD_SELECT = '*, items:order_items(*), shipment:shipments(status, courier_name)';

/** Tablero: activos + cerrados de los últimos 7 días (como /vendedor/pedidos del web). */
export function useVendorBoard(businessId: string | undefined) {
  return useQuery({
    queryKey: ['vendor-board', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [active, recent] = await Promise.all([
        supabase
          .from('orders')
          .select(BOARD_SELECT)
          .eq('business_id', businessId!)
          .in('status', ['preparing', 'ready', 'ready_for_pickup', 'on_the_way'])
          .order('paid_at', { ascending: true }),
        supabase
          .from('orders')
          .select(BOARD_SELECT)
          .eq('business_id', businessId!)
          .in('status', ['delivered', 'disputed', 'completed', 'cancelled', 'refunded', 'returned'])
          .not('paid_at', 'is', null)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(30),
      ]);
      return { active: (active.data ?? []) as BoardOrder[], recent: (recent.data ?? []) as BoardOrder[] };
    },
  });
}

export function useVendorDashboard(businessId: string | undefined, period: string) {
  return useQuery({
    queryKey: ['vendor-dashboard', businessId, period],
    enabled: !!businessId,
    queryFn: async () => {
      const [report, lowStock, reviews, preparing] = await Promise.all([
        reportOrdersWith(supabase, { period, businessId, withItems: true }),
        supabase.from('products').select('id, name, stock').eq('business_id', businessId!).eq('is_active', true).lte('stock', 3).order('stock').limit(8),
        supabase.from('reviews').select('*').eq('business_id', businessId!).order('created_at', { ascending: false }).limit(4),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', businessId!).eq('status', 'preparing'),
      ]);
      return {
        ...report,
        lowStock: (lowStock.data ?? []) as Pick<Product, 'id' | 'name' | 'stock'>[],
        reviews: await withReviewAuthors((reviews.data ?? []) as Review[]),
        preparing: preparing.count ?? 0,
      };
    },
  });
}

export function useVendorProducts(businessId: string | undefined) {
  return useQuery({
    queryKey: ['vendor-products', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('business_id', businessId!).order('created_at', { ascending: false });
      return (data ?? []) as Product[];
    },
  });
}

export function useVendorProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['vendor-product', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('id', id!).maybeSingle();
      return (data as Product | null) ?? null;
    },
  });
}

export function useProductCategories(businessId: string | undefined) {
  return useQuery({
    queryKey: ['product-categories', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase.from('product_categories').select('*').eq('business_id', businessId!).order('sort_order');
      return (data ?? []) as ProductCategory[];
    },
  });
}

export function useBusinessHours(businessId: string | undefined) {
  return useQuery({
    queryKey: ['business-hours', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const [hours, closures] = await Promise.all([
        supabase.from('business_hours').select('*').eq('business_id', businessId!).order('day_of_week'),
        supabase.from('business_closures').select('*').eq('business_id', businessId!).order('date'),
      ]);
      return { hours: (hours.data ?? []) as BusinessHour[], closures: (closures.data ?? []) as BusinessClosure[] };
    },
  });
}

export function useFinances(businessId: string | undefined, period: string) {
  return useQuery({
    queryKey: ['vendor-finances', businessId, period],
    enabled: !!businessId,
    queryFn: async () => {
      const [report, payouts, rate, ledger, strikes, inWindow] = await Promise.all([
        reportOrdersWith(supabase, { period, businessId }),
        supabase.from('payouts').select('*').eq('business_id', businessId!).order('period_end', { ascending: false }),
        supabase.rpc('commission_rate_for', { p_business: businessId }),
        supabase.from('ledger_entries').select('*').eq('business_id', businessId!).order('created_at', { ascending: false }).limit(200),
        supabase.from('strikes').select('*').eq('business_id', businessId!).order('created_at', { ascending: false }).limit(20),
        supabase.from('orders').select('vendor_net_minor').eq('business_id', businessId!).in('status', ['delivered', 'disputed']),
      ]);
      return {
        orders: report.orders,
        payouts: (payouts.data ?? []) as Payout[],
        rate: Number(rate.data ?? 0.08),
        ledger: (ledger.data ?? []) as LedgerEntry[],
        strikes: (strikes.data ?? []) as Strike[],
        inClaimWindow: ((inWindow.data ?? []) as { vendor_net_minor: number }[]).reduce((sum, o) => sum + o.vendor_net_minor, 0),
      };
    },
  });
}

/** Datos de la solicitud: cuenta bancaria, documentos, GPS del local y comisión vigente. */
export function useApplication(businessId: string | undefined) {
  return useQuery({
    queryKey: ['application', businessId],
    queryFn: async () => {
      const [rate, bank, documents, location] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'commission_rate').maybeSingle(),
        businessId ? supabase.from('business_bank_accounts').select('*').eq('business_id', businessId).maybeSingle() : Promise.resolve({ data: null }),
        businessId ? supabase.from('business_documents').select('*').eq('business_id', businessId) : Promise.resolve({ data: [] }),
        businessId
          ? supabase.from('business_private').select('latitude, longitude').eq('business_id', businessId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        commissionRate: Number(rate.data?.value ?? 0.08),
        bank: bank.data as BankAccount | null,
        documents: (documents.data ?? []) as BusinessDocument[],
        location: location.data as { latitude: number | null; longitude: number | null } | null,
      };
    },
  });
}

/**
 * Ejecuta una acción compartida del negocio (src/features/businesses/mutations)
 * con el cliente de la app, muestra el resultado y refresca las consultas.
 */
export function useVendorAction<A extends unknown[], T>(
  action: (client: SupabaseClient, userId: string, ...args: A) => Promise<ActionResult<T>>,
  options: { success?: string; invalidate?: string[] } = {},
) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: A) => {
      const result = await action(supabase, session!.user.id, ...args);
      if (!result.ok) throw Object.assign(new Error(result.error), { fieldErrors: result.fieldErrors });
      return result.data;
    },
    onSuccess: () => {
      if (options.success) toast.success(options.success);
      for (const key of options.invalidate ?? ['my-business']) queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Errores por campo de una acción fallida (para mostrarlos bajo cada input). */
export function actionFieldErrors(error: unknown): Record<string, string> {
  const fields = (error as { fieldErrors?: Record<string, string[]> } | null)?.fieldErrors ?? {};
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]!]));
}
