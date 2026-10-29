import { useRouter } from 'expo-router';
import { History, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SHIPMENT_STATUS } from '@/features/couriers/status';
import { formatDate } from '@/lib/format';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { badgeTone } from '~/components/ui/status';
import { Text } from '~/components/ui/text';
import { useCourier, useCourierHistory } from '~/features/couriers/queries';

/** Entregas terminadas: sin datos personales del cliente. */
export default function CourierHistory() {
  const router = useRouter();
  const courier = useCourier();
  const history = useCourierHistory();
  const rows = history.data ?? [];
  const delivered = rows.filter((r) => r.status === 'delivered').length;
  const c = courier.data;

  return (
    <Screen edges={['top']} refreshing={history.isRefetching} onRefresh={() => void history.refetch()}>
      <Text variant="title">Historial</Text>
      <Text variant="small" tone="muted">
        Tus entregas terminadas y cómo te calificaron.
      </Text>
      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text variant="small" tone="muted">
            Entregadas
          </Text>
          <Text variant="title" tone="primary">
            {delivered}
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="small" tone="muted">
            Calificación
          </Text>
          <Text variant="title" tone="primary">
            {c?.rating_count ? `${Number(c.rating_avg).toFixed(1)} ★` : '—'}
          </Text>
          <Text variant="small" tone="muted">
            {c?.rating_count ? `${c.rating_count} calificaciones` : 'Aún sin calificaciones'}
          </Text>
        </Card>
      </View>
      {history.isLoading ? (
        <Skeleton height={80} />
      ) : rows.length ? (
        rows.map((r, i) => {
          const [label, tone] = SHIPMENT_STATUS[r.status];
          return (
            <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)}>
              <Card onPress={() => router.push(`/repartidor/entrega/${r.id}`)} style={styles.row}>
                <View style={styles.flex}>
                  <View style={styles.inline}>
                    <Text variant="bodyMedium">{r.order_number}</Text>
                    <Badge tone={badgeTone(tone)}>{label}</Badge>
                  </View>
                  <Text variant="small" tone="muted">
                    {r.business} → {r.municipality} · {formatDate(r.delivered_at ?? r.updated_at)}
                  </Text>
                </View>
                {r.rating ? (
                  <View style={styles.inline}>
                    <Star size={14} color="#E3A008" fill="#E3A008" />
                    <Text variant="smallMedium">{r.rating}</Text>
                  </View>
                ) : null}
              </Card>
            </Animated.View>
          );
        })
      ) : (
        <EmptyState icon={History} title="Aún no terminas entregas" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
