import { useRouter } from 'expo-router';
import { AlertTriangle, Ban, Coins, Package, Receipt, ShoppingBag, Star, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { salesSeries, summarize, topProducts } from '@/features/reports/compute';
import { seriesLabel } from '@/features/reports/read';
import { formatMoney, formatPercent } from '@/lib/format';
import { ReviewItem } from '~/components/catalog/review-item';
import { PanelHeader } from '~/components/layout/panel-header';
import { Card, Divider } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { PeriodFilter, SalesBars, StatCard, TierCard } from '~/components/vendor/vendor-bits';
import { useMyBusiness, useVendorDashboard } from '~/features/vendor/queries';
import { colors, radius } from '~/theme/tokens';

export default function VendorDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState('30d');
  const business = useMyBusiness().data!;
  const dashboard = useVendorDashboard(business.id, period);
  const d = dashboard.data;
  const summary = d ? summarize(d.orders) : null;
  const series = d ? salesSeries(d.orders, d.range.from, d.range.to, d.range.granularity) : [];
  const top = d ? topProducts(d.orders) : [];

  return (
    <Screen edges={['top']} refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()}>
      <PanelHeader title={`Hola, ${business.trade_name}`} subtitle="Panel del vendedor" />
      {business.status === 'suspended' && (
        <Card style={styles.suspended}>
          <Text variant="bodyMedium" tone="danger">
            Tu tienda está suspendida
          </Text>
          <Text variant="small">Los clientes no la ven. Contacta a la administración para reactivarla.</Text>
        </Card>
      )}
      <TierCard />
      {(d?.preparing ?? 0) > 0 && (
        <Pressable onPress={() => router.push('/vendedor/pedidos')} style={styles.preparing}>
          <ShoppingBag size={20} color={colors.white} />
          <Text variant="bodyMedium" tone="white" style={styles.flex}>
            Tienes {d!.preparing} {d!.preparing === 1 ? 'pedido' : 'pedidos'} en preparación
          </Text>
          <Text variant="small" tone="white">
            Abrir →
          </Text>
        </Pressable>
      )}
      <PeriodFilter value={period} onChange={setPeriod} />
      {!summary ? (
        <Skeleton height={180} />
      ) : (
        <Animated.View entering={FadeInDown} style={styles.stats}>
          <StatCard icon={Receipt} label="Ventas (productos)" value={formatMoney(summary.gross)} hint={`${summary.orders} pedidos`} />
          <StatCard icon={Coins} label="Ticket promedio" value={formatMoney(summary.avgTicket)} hint="Incluye envío" />
          <StatCard icon={Wallet} label="Neto a recibir" value={formatMoney(summary.net)} hint={`Comisión: ${formatMoney(summary.commission)}`} />
          <StatCard icon={Ban} label="Cancelación" value={formatPercent(summary.cancellationRate)} hint={`${summary.cancelled} cancelados`} />
        </Animated.View>
      )}

      {d && summary && (
        <Card style={styles.gap}>
          <Text variant="heading">Ventas</Text>
          <Text variant="small" tone="muted">
            Subtotal de productos por {d.range.granularity === 'day' ? 'día' : d.range.granularity === 'week' ? 'semana' : 'mes'}
          </Text>
          {summary.orders === 0 ? (
            <Text variant="small" tone="muted" style={styles.empty}>
              Aún no hay ventas en este período.
            </Text>
          ) : (
            <SalesBars data={series.map((p) => ({ label: seriesLabel(p.key, d.range.granularity), value: p.sales, detail: `${p.orders} pedidos` }))} />
          )}
        </Card>
      )}

      <Card style={styles.gap}>
        <Text variant="heading">Más vendidos</Text>
        {top.length === 0 ? (
          <Text variant="small" tone="muted">
            Sin datos todavía.
          </Text>
        ) : (
          top.map((p, i) => (
            <View key={p.name} style={styles.topRow}>
              <View style={styles.rank}>
                <Text variant="smallMedium">{i + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="small" tone="muted">
                  {p.quantity} unidades
                </Text>
              </View>
              <Text variant="smallMedium">{formatMoney(p.revenue)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Stock bajo</Text>
        <Text variant="small" tone="muted">
          Productos visibles con 3 unidades o menos.
        </Text>
        {(d?.lowStock ?? []).length === 0 ? (
          <View style={styles.inline}>
            <Package size={16} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Todo con buen inventario.
            </Text>
          </View>
        ) : (
          d!.lowStock.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/vendedor/productos/${p.id}`)} style={styles.topRow}>
              <Text variant="body" style={styles.flex} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.inline}>
                {p.stock === 0 && <AlertTriangle size={14} color={colors.danger} />}
                <Text variant="smallMedium" tone={p.stock === 0 ? 'danger' : 'warning'}>
                  {p.stock === 0 ? 'Agotado' : `${p.stock} u.`}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Card style={styles.gap}>
        <Text variant="heading">Reseñas recientes</Text>
        {business.rating_count ? (
          <Text variant="small" tone="muted">
            {Number(business.rating_avg).toFixed(1)} de 5 · {business.rating_count} reseñas
          </Text>
        ) : null}
        {(d?.reviews ?? []).length === 0 ? (
          <View style={styles.inline}>
            <Star size={16} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              Aún no tienes reseñas.
            </Text>
          </View>
        ) : (
          d!.reviews.map((r, i) => (
            <View key={r.id} style={styles.gap}>
              {i > 0 && <Divider />}
              <ReviewItem review={r} />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suspended: { backgroundColor: colors.dangerSoft, borderColor: '#F2C4C1', gap: 4 },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.catarina },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
});
