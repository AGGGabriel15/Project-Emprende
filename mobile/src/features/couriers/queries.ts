import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Courier, Shipment, ShipmentStatus } from '@/types/domain';
import { useSession } from '~/features/auth/session';
import { api, processRefunds } from '~/lib/api';
import { errorMessage } from '@/lib/format';
import { currentPosition } from '~/lib/position';
import { supabase } from '~/lib/supabase';
import { uploadImage } from '~/lib/upload';

/** Tipos de las funciones courier_deliveries / available_shipments / courier_delivery (igual que el web). */
export type AvailableShipment = {
  id: string;
  order_number: string;
  ready_at: string;
  business: string;
  business_address: string | null;
  business_municipality: string | null;
  municipality: string | null;
  department: string | null;
  items: number;
};

export type ActiveDelivery = {
  id: string;
  status: ShipmentStatus;
  order_number: string;
  business: string;
  municipality: string | null;
  customer: string | null;
  attempts: number;
};

export type FinishedDelivery = {
  id: string;
  status: ShipmentStatus;
  order_number: string;
  business: string;
  municipality: string | null;
  delivered_at: string | null;
  updated_at: string;
  rating: number | null;
};

export type DeliveryView = {
  shipment: Shipment;
  active: boolean;
  order: {
    id: string;
    order_number: string;
    status: string;
    ready_photo_path: string | null;
    municipality: string | null;
    department: string | null;
    items: { name: string; quantity: number; image: string | null }[];
  };
  customer: { name: string; phone?: string; address_line?: string; note?: string | null };
  business: {
    trade_name: string;
    phone: string | null;
    whatsapp: string | null;
    address_line: string | null;
    municipality: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  rating: { rating: number; tags: string[]; comment: string | null } | null;
};

export function useCourier() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['courier', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from('couriers').select('*').eq('profile_id', session!.user.id).single();
      return data as Courier | null;
    },
  });
}

export function useCourierBoard(online: boolean) {
  const { session } = useSession();
  return useQuery({
    queryKey: ['courier-board', online],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [active, available] = await Promise.all([
        supabase.rpc('courier_deliveries', { p_scope: 'active' }),
        online ? supabase.rpc('available_shipments') : Promise.resolve({ data: [] }),
      ]);
      return { mine: (active.data ?? []) as ActiveDelivery[], open: (available.data ?? []) as AvailableShipment[] };
    },
  });
}

export function useCourierHistory() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['courier-history'],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.rpc('courier_deliveries', { p_scope: 'history' });
      return (data ?? []) as FinishedDelivery[];
    },
  });
}

/** Una entrega: los datos del cliente solo llegan mientras está activa. */
export function useDelivery(id: string) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: async () => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data } = await supabase.rpc('courier_delivery', { p_shipment: id });
      const view = data as DeliveryView | null;
      if (!view) return null;
      // Foto del negocio al empacar (para comparar al recoger), firmada por el servidor.
      const evidence = view.active && view.order.ready_photo_path ? await api<Record<string, string>>(`orders/${view.order.id}/evidence`) : null;
      return { ...view, readyPhoto: evidence?.ok ? (evidence.data[view.order.ready_photo_path!] ?? null) : null };
    },
  });
}

function useInvalidateCourier() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['courier'] });
    queryClient.invalidateQueries({ queryKey: ['courier-board'] });
    queryClient.invalidateQueries({ queryKey: ['delivery'] });
    queryClient.invalidateQueries({ queryKey: ['courier-history'] });
  };
}

export function useSetOnline() {
  const invalidate = useInvalidateCourier();
  return useMutation({
    mutationFn: async (online: boolean) => {
      const position = online ? await currentPosition() : null;
      const { error } = await supabase.rpc('set_courier_online', { p_online: online, p_lat: position?.lat ?? null, p_lng: position?.lng ?? null });
      if (error) throw new Error(errorMessage(error));
    },
    onSettled: invalidate,
  });
}

export function useAcceptShipment() {
  const invalidate = useInvalidateCourier();
  return useMutation({
    mutationFn: async (shipment: string) => {
      const { error } = await supabase.rpc('accept_shipment', { p_shipment: shipment });
      if (error) throw new Error(errorMessage(error));
    },
    onSettled: invalidate,
  });
}

const PIN_MESSAGES: Record<string, string> = {
  wrong_pin: 'PIN incorrecto. Pídele al cliente el código de 4 dígitos que ve en su pedido.',
  locked: 'Demasiados intentos con PIN incorrecto. Llama a Catarina Market.',
  invalid: 'El pedido no tiene PIN.',
};

export type StepKind = 'arrive_pickup' | 'pickup' | 'reject' | 'arrive_dropoff' | 'deliver' | 'fail' | 'release';

/**
 * Cada paso de la entrega (mismas funciones SQL que el web): guarda la hora,
 * el GPS y la foto en delivery-evidence/<repartidor>/courier/<envío>/.
 */
export function useCourierStep(shipmentId: string, orderId: string) {
  const invalidate = useInvalidateCourier();
  return useMutation({
    mutationFn: async ({ kind, photo, notes = '', pin = '' }: { kind: StepKind; photo?: string | null; notes?: string; pin?: string }) => {
      const position = kind === 'release' || kind === 'fail' ? null : await currentPosition();
      const coords = { p_lat: position?.lat ?? null, p_lng: position?.lng ?? null };
      const upload = async () => {
        if (!photo) throw new Error('Toma la foto.');
        return (await uploadImage(photo, 'delivery-evidence', `courier/${shipmentId}`)).path;
      };
      let refunds = false;
      if (kind === 'arrive_pickup' || kind === 'arrive_dropoff') {
        const { error } = await supabase.rpc('courier_arrive', { p_shipment: shipmentId, p_stage: kind === 'arrive_pickup' ? 'pickup' : 'dropoff', ...coords });
        if (error) throw new Error(errorMessage(error));
      } else if (kind === 'release') {
        const { error } = await supabase.rpc('courier_release', { p_shipment: shipmentId, p_reason: notes });
        if (error) throw new Error(errorMessage(error));
      } else if (kind === 'fail') {
        const { data, error } = await supabase.rpc('courier_fail', { p_shipment: shipmentId, p_notes: notes });
        if (error) throw new Error(errorMessage(error));
        refunds = data === 'returned';
      } else if (kind === 'pickup') {
        const { error } = await supabase.rpc('courier_pickup', { p_shipment: shipmentId, p_photo_path: await upload(), p_notes: notes, ...coords });
        if (error) throw new Error(errorMessage(error));
      } else if (kind === 'reject') {
        const { error } = await supabase.rpc('courier_reject', { p_shipment: shipmentId, p_reason: notes, p_photo_path: await upload() });
        if (error) throw new Error(errorMessage(error));
        refunds = true;
      } else {
        const { data, error } = await supabase.rpc('courier_deliver', { p_shipment: shipmentId, p_pin: pin.trim(), p_photo_path: await upload(), ...coords });
        if (error) throw new Error(errorMessage(error));
        if (data !== 'ok') throw new Error(PIN_MESSAGES[data as string] ?? 'No se pudo confirmar la entrega.');
      }
      // El reembolso queda en cola en la base; el servidor lo ejecuta en la pasarela.
      if (refunds) await processRefunds(orderId);
    },
    onSettled: invalidate,
  });
}
