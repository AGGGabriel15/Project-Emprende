import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Bike, Camera, ClipboardList, KeyRound, MapPin, Phone, RefreshCw, Store, Truck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { BoardOrder } from '@/features/orders/read';
import { completeWithPinWith, markOrderReadyWith } from '@/features/orders/mutations';
import { ORDER_STATUS_LABEL, vendorAction } from '@/features/orders/status';
import { formatDate, formatMoney } from '@/lib/format';
import { formatPhone, phoneHref } from '@/lib/phone';
import type { OrderStatus } from '@/types/domain';
import { PanelHeader } from '~/components/layout/panel-header';
import { CancelSheet } from '~/components/orders/order-forms';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Sheet } from '~/components/ui/sheet';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useMyBusiness, useVendorBoard } from '~/features/vendor/queries';
import { useRealtimeRefresh } from '~/lib/realtime';
import { supabase } from '~/lib/supabase';
import { nowMs } from '~/lib/time';
import { pickImage, uploadImage } from '~/lib/upload';
import { colors, fonts, radius } from '~/theme/tokens';

const COLUMNS: { key: string; title: string; statuses: OrderStatus[]; hint: string }[] = [
  { key: 'prep', title: 'En preparación', statuses: ['preparing'], hint: 'Empácalo y marca listo con una foto' },
  { key: 'ready', title: 'Listos', statuses: ['ready', 'ready_for_pickup'], hint: 'Esperan al repartidor o al cliente' },
  { key: 'road', title: 'En camino', statuses: ['on_the_way'], hint: 'El repartidor lo lleva al cliente' },
];

/** Cómo va el repartidor, en palabras del negocio. */
const SHIPMENT_LABEL: Record<string, string> = {
  available: 'buscando repartidor',
  assigned: 'va camino a tu negocio',
  at_pickup: 'llegó a recoger',
  picked_up: 'lo lleva al cliente',
  at_dropoff: 'llegó donde el cliente',
  delivered: 'entregado',
  rejected: 'rechazado al recoger',
  returned: 'devuelto',
  failed: 'intento fallido',
};

export default function VendorOrders() {
  const business = useMyBusiness().data!;
  const board = useVendorBoard(business.id);
  const [column, setColumn] = useState('prep');
  const [readyFor, setReadyFor] = useState<BoardOrder | null>(null);
  const [pinFor, setPinFor] = useState<BoardOrder | null>(null);
  const [cancelFor, setCancelFor] = useState<BoardOrder | null>(null);
  const readOnly = business.status !== 'approved';
  useRealtimeRefresh('orders', `business_id=eq.${business.id}`, ['vendor-board']);
  useRealtimeRefresh('shipments', '*', ['vendor-board']);

  // Aviso con vibración cuando entra un pedido pagado nuevo.
  const seen = useRef<Set<string> | null>(null);
  const active = board.data?.active;
  useEffect(() => {
    if (!active) return;
    const preparing = active.filter((o) => o.status === 'preparing');
    if (seen.current) {
      const fresh = preparing.find((o) => !seen.current!.has(o.id));
      if (fresh) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast.success(`¡Nuevo pedido ${fresh.order_number}! Ya está pagado.`);
        setColumn('prep');
      }
    }
    seen.current = new Set(active.map((o) => o.id));
  }, [active]);

  const recent = board.data?.recent ?? [];
  const list = column === 'recent' ? recent : (active ?? []).filter((o) => COLUMNS.find((c) => c.key === column)!.statuses.includes(o.status));
  const hint = COLUMNS.find((c) => c.key === column)?.hint ?? 'Cerrados en los últimos 7 días';

  return (
    <Screen edges={['top']} refreshing={board.isRefetching} onRefresh={() => void board.refetch()}>
      <PanelHeader title="Pedidos" subtitle="Empaca, toma la foto y marca listo: Catarina Market lo recoge y lo entrega." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {[...COLUMNS, { key: 'recent', title: 'Recientes', statuses: [] as OrderStatus[] }].map((c) => {
          const count = c.key === 'recent' ? recent.length : (active ?? []).filter((o) => c.statuses.includes(o.status)).length;
          const on = column === c.key;
          return (
            <Pressable key={c.key} onPress={() => setColumn(c.key)} style={[styles.tab, on && styles.tabOn]}>
              <Text variant="smallMedium" tone={on ? 'white' : 'default'}>
                {c.title}
              </Text>
              {count > 0 && (
                <View style={[styles.count, on && styles.countOn]}>
                  <Text style={[styles.countText, on && styles.countTextOn]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text variant="small" tone="muted">
        {hint}
      </Text>
      {board.isLoading ? (
        <Skeleton height={180} />
      ) : list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin pedidos aquí" />
      ) : (
        list.map((order, i) => (
          <Animated.View key={order.id} entering={FadeInDown.delay(Math.min(i, 5) * 60)} layout={LinearTransition}>
            <OrderCard
              order={order}
              readOnly={readOnly || column === 'recent'}
              onReady={() => setReadyFor(order)}
              onHandOver={() => setPinFor(order)}
              onCancel={() => setCancelFor(order)}
            />
          </Animated.View>
        ))
      )}
      {readyFor && <ReadySheet order={readyFor} onClose={() => setReadyFor(null)} />}
      {pinFor && <PinSheet order={pinFor} onClose={() => setPinFor(null)} />}
      {cancelFor && <CancelSheet orderId={cancelFor.id} open onClose={() => setCancelFor(null)} />}
    </Screen>
  );
}

function OrderCard({
  order,
  readOnly,
  onReady,
  onHandOver,
  onCancel,
}: {
  order: BoardOrder;
  readOnly: boolean;
  onReady: () => void;
  onHandOver: () => void;
  onCancel: () => void;
}) {
  const action = vendorAction(order.status, order.service_type, Boolean(order.shipment));
  const overdue = order.status === 'preparing' && order.sla_due_at !== null && new Date(order.sla_due_at).getTime() - nowMs() < 2 * 3_600_000;
  const delivery = order.service_type === 'delivery';
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyMedium">{order.order_number}</Text>
          <Text variant="small" tone="muted">
            {order.paid_at ? `Pagado ${formatDate(order.paid_at)}` : ORDER_STATUS_LABEL[order.status]}
          </Text>
        </View>
        <Badge tone={delivery ? 'violet' : 'blue'} icon={delivery ? Bike : Store}>
          {delivery ? 'Delivery' : 'Retiro'}
        </Badge>
      </View>

      {order.status === 'preparing' && order.sla_due_at && (
        <View style={[styles.sla, overdue && styles.slaLate]}>
          <Text variant="small" tone={overdue ? 'danger' : 'muted'}>
            Márcalo listo antes de {formatDate(order.sla_due_at)} o se cancelará con falta.
          </Text>
        </View>
      )}

      <View style={styles.items}>
        {order.items.map((item) => (
          <View key={item.id}>
            <Text variant="body">
              <Text variant="bodyMedium">{item.quantity}×</Text> {item.product_name}
            </Text>
            {item.note ? (
              <Text variant="small" tone="muted">
                “{item.note}”
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {order.customer_note ? (
        <View style={styles.note}>
          <Text variant="small">Nota: {order.customer_note}</Text>
        </View>
      ) : null}

      <View style={styles.meta}>
        {delivery ? (
          <View style={styles.inline}>
            <Truck size={14} color={colors.mutedForeground} />
            <Text variant="small" tone={order.shipment?.status === 'at_pickup' ? 'primary' : 'muted'} style={styles.flex}>
              {order.shipment?.courier_name
                ? `Repartidor: ${order.shipment.courier_name} · ${SHIPMENT_LABEL[order.shipment.status] ?? order.shipment.status}`
                : order.status === 'ready'
                  ? 'Buscando repartidor'
                  : 'La entrega la coordina Catarina Market'}
            </Text>
          </View>
        ) : (
          <Pressable style={styles.inline} onPress={() => Linking.openURL(phoneHref(order.contact_phone))}>
            <Phone size={14} color={colors.catarina} />
            <Text variant="small" tone="primary">
              {order.contact_name} · {formatPhone(order.contact_phone)}
            </Text>
          </Pressable>
        )}
        {order.address_snapshot && (
          <View style={styles.inline}>
            <MapPin size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {order.address_snapshot.municipality}, {order.address_snapshot.department}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <Text variant="small" tone="muted" style={styles.flex}>
          Productos {formatMoney(order.subtotal_minor)}
        </Text>
        <Text variant="bodyMedium">Recibes {formatMoney(order.vendor_net_minor)}</Text>
      </View>

      {!readOnly && (action || ['preparing', 'ready', 'ready_for_pickup'].includes(order.status)) && (
        <View style={styles.row}>
          {action && (
            <Button icon={action.kind === 'ready' ? Camera : KeyRound} onPress={action.kind === 'ready' ? onReady : onHandOver} style={styles.flex} block>
              {action.label}
            </Button>
          )}
          {['preparing', 'ready', 'ready_for_pickup'].includes(order.status) && (
            <Button variant="ghost" onPress={onCancel}>
              Cancelar
            </Button>
          )}
        </View>
      )}
    </Card>
  );
}

function useRefreshBoard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['vendor-board'] });
}

/** Foto del pedido empacado: evidencia de lo que se entrega al repartidor o al cliente. */
function ReadySheet({ order, onClose }: { order: BoardOrder; onClose: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const refresh = useRefreshBoard();
  async function take() {
    const { uri, error } = await pickImage('camera');
    if (error) return toast.error(error);
    if (uri) setPhoto(uri);
  }
  async function submit() {
    if (!photo) return;
    setPending(true);
    try {
      const { path } = await uploadImage(photo, 'delivery-evidence', 'ready');
      const result = await markOrderReadyWith(supabase, order.id, path);
      if (!result.ok) return toast.error(result.error);
      toast.success(order.service_type === 'delivery' ? 'Listo. Avisamos a los repartidores.' : 'Listo. Avisamos al cliente que puede retirarlo.');
      refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos marcarlo listo.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Listo · ${order.order_number}`}
      description="Toma una foto del pedido empacado. Es la evidencia de lo que entregas."
      footer={
        <Button onPress={submit} loading={pending} disabled={!photo} block style={styles.flex}>
          Marcar listo
        </Button>
      }
    >
      <Pressable onPress={take} style={styles.photo}>
        {photo ? (
          <>
            <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.retake}>
              <RefreshCw size={14} color={colors.white} />
              <Text variant="small" tone="white">
                Repetir
              </Text>
            </View>
          </>
        ) : (
          <>
            <Camera size={28} color={colors.catarina} />
            <Text variant="smallMedium" tone="primary">
              Tomar foto
            </Text>
          </>
        )}
      </Pressable>
    </Sheet>
  );
}

/** Retiro en el negocio: se entrega solo con el PIN del cliente. */
function PinSheet({ order, onClose }: { order: BoardOrder; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = useRefreshBoard();
  async function submit() {
    setPending(true);
    const result = await completeWithPinWith(supabase, order.id, pin);
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success('¡Entregado!');
    refresh();
    onClose();
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Entregar ${order.order_number}`}
      description="Pídele al cliente el PIN de 4 dígitos que ve en su pedido. Sin PIN no se puede entregar."
      footer={
        <>
          <Button variant="outline" onPress={onClose} block style={styles.flex}>
            Volver
          </Button>
          <Button icon={KeyRound} onPress={submit} loading={pending} disabled={pin.length !== 4} block style={styles.flex}>
            Confirmar entrega
          </Button>
        </>
      }
    >
      <Text variant="smallMedium">PIN del cliente</Text>
      <TextInput
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        autoFocus
        placeholder="• • • •"
        placeholderTextColor={colors.input}
        style={styles.pin}
        accessibilityLabel="PIN del cliente"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countOn: { backgroundColor: colors.white },
  countText: { fontSize: 11, fontFamily: fonts.sansBold, color: colors.catarina },
  countTextOn: { color: colors.catarina },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sla: { borderRadius: radius.sm, backgroundColor: colors.muted, padding: 8 },
  slaLate: { backgroundColor: colors.dangerSoft },
  items: { gap: 4 },
  note: { borderRadius: radius.sm, backgroundColor: colors.warningSoft, padding: 8 },
  meta: { gap: 4, borderTopWidth: 1, borderTopColor: colors.muted, paddingTop: 10 },
  photo: {
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.hojaClara,
    backgroundColor: colors.niebla,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  retake: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(14,59,39,0.7)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  pin: { height: 64, borderRadius: radius.md, borderWidth: 2, borderColor: colors.brote, textAlign: 'center', fontFamily: fonts.display, fontSize: 32, letterSpacing: 16, color: colors.foreground },
});
