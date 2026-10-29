import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { OrderListItem } from '@/features/orders/read';
import { CUSTOMER_TABS, customerTabFor, type CustomerTab } from '@/features/orders/status';
import { formatDate, formatMoney } from '@/lib/format';
import { OrderStatusBadge } from '~/components/orders/order-bits';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { resumePayment } from '~/features/checkout/payment';
import { useMyOrders } from '~/features/orders/queries';
import { useRealtimeRefresh } from '~/lib/realtime';
import { colors, radius } from '~/theme/tokens';

const TABS: { key: CustomerTab; label: string }[] = [
  { key: 'activos', label: 'En curso' },
  { key: 'pendientes', label: 'Por pagar' },
  { key: 'historial', label: 'Historial' },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { session } = useSession();
  const orders = useMyOrders();
  const [tab, setTab] = useState<CustomerTab | null>(null);
  useRealtimeRefresh('orders', session ? `customer_id=eq.${session.user.id}` : null, ['orders', 'mine']);

  if (!session) {
    return (
      <Screen edges={['top']}>
        <Text variant="title">Mis pedidos</Text>
        <EmptyState
          icon={Package}
          title="Entra para ver tus pedidos"
          description="Sigue cada pedido en vivo y recibe tu PIN de entrega."
          action={<Button onPress={() => router.push({ pathname: '/login', params: { next: '/pedidos' } })}>Entrar</Button>}
        />
      </Screen>
    );
  }

  const all = orders.data ?? [];
  const active = tab ?? (all.some((o) => customerTabFor(o.status) === 'activos') ? 'activos' : all.some((o) => o.status === 'pending_payment') ? 'pendientes' : 'historial');
  const list = all.filter((o) => (CUSTOMER_TABS[active] as readonly string[]).includes(o.status));

  return (
    <Screen edges={['top']} refreshing={orders.isRefetching} onRefresh={orders.refetch}>
      <Text variant="title">Mis pedidos</Text>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = all.filter((o) => customerTabFor(o.status) === t.key).length;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active === t.key && styles.tabActive]}>
              <Text variant="smallMedium" tone={active === t.key ? 'white' : 'default'}>
                {t.label}
                {count ? ` · ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {orders.isLoading ? (
        <Skeleton height={110} />
      ) : list.length ? (
        list.map((order, i) => (
          <Animated.View key={order.id} entering={FadeInDown.delay(Math.min(i, 6) * 60).springify().damping(18)}>
            <OrderRow order={order} onPress={() => router.push(`/pedidos/${order.id}`)} />
          </Animated.View>
        ))
      ) : (
        <EmptyState
          icon={Package}
          title={active === 'activos' ? 'No tienes pedidos en curso' : active === 'pendientes' ? 'Nada pendiente de pago' : 'Aún no hay historial'}
          action={<Button onPress={() => router.push('/buscar')}>Explorar productos</Button>}
        />
      )}
    </Screen>
  );
}

function OrderRow({ order, onPress }: { order: OrderListItem; onPress: () => void }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const names = order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ');
  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={styles.head}>
        <View style={styles.logo}>{order.business.logo_url ? <Image source={order.business.logo_url} style={StyleSheet.absoluteFill} /> : null}</View>
        <View style={styles.flex}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {order.business.trade_name}
          </Text>
          <Text variant="small" tone="muted">
            {order.order_number} · {formatDate(order.created_at)}
          </Text>
        </View>
        <Text variant="price">{formatMoney(order.total_minor)}</Text>
      </View>
      <Text variant="small" tone="muted" numberOfLines={2}>
        {names}
      </Text>
      <View style={styles.foot}>
        <OrderStatusBadge status={order.status} />
        {order.status === 'pending_payment' && (
          <Button
            size="sm"
            loading={paying}
            onPress={async () => {
              setPaying(true);
              const error = await resumePayment(router, order.id);
              setPaying(false);
              if (error) toast.error(error);
            }}
          >
            Pagar
          </Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  row: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.niebla, overflow: 'hidden' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
