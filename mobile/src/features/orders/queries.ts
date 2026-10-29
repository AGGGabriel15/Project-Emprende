import { useQuery } from '@tanstack/react-query';
import { getOrderDetailWith, listOrdersWith } from '@/features/orders/read';
import { showsPin } from '@/features/orders/status';
import type { OrderCourier } from '@/types/domain';
import { useSession } from '~/features/auth/session';
import { api } from '~/lib/api';
import { supabase } from '~/lib/supabase';

export function useMyOrders() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['orders', 'mine', session?.user.id],
    enabled: !!session,
    queryFn: () => listOrdersWith(supabase, { customerId: session!.user.id, limit: 100 }),
  });
}

/** Detalle del pedido del cliente, con su PIN, repartidor y calificación (como /pedidos/[id] del web). */
export function useOrderDetail(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const order = await getOrderDetailWith(supabase, id);
      if (!order) return null;
      const delivery = order.service_type === 'delivery';
      const [secret, windowSetting, courier, rating] = await Promise.all([
        showsPin(order.status)
          ? supabase.from('order_secrets').select('pin').eq('order_id', order.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('platform_settings').select('value').eq('key', 'claim_window_hours').maybeSingle(),
        delivery ? supabase.rpc('order_courier', { p_order: order.id }) : Promise.resolve({ data: null }),
        delivery ? supabase.from('delivery_ratings').select('rating, tags, comment').eq('order_id', order.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const courierRow = (Array.isArray(courier.data) ? courier.data[0] : courier.data) as OrderCourier | null;
      return {
        order,
        pin: (secret.data as { pin: string } | null)?.pin ?? null,
        claimHours: Number(windowSetting.data?.value ?? 48),
        courier: courierRow ?? null,
        deliveryRating: rating.data as { rating: number; tags: string[]; comment: string | null } | null,
      };
    },
  });
}

/** URLs firmadas de las fotos de evidencia (bucket privado): las firma el servidor. */
export function useEvidence(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['evidence', orderId],
    enabled,
    staleTime: 8 * 60_000,
    queryFn: async () => {
      const result = await api<Record<string, string>>(`orders/${orderId}/evidence`);
      return result.ok ? result.data : {};
    },
  });
}
