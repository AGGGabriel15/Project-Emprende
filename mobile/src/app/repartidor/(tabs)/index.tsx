import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, PackageSearch, Store } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SHIPMENT_STATUS } from '@/features/couriers/status';
import { formatDate } from '@/lib/format';
import { PatternBackground } from '~/components/brand/pattern';
import { PanelHeader } from '~/components/layout/panel-header';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, SectionTitle } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { badgeTone } from '~/components/ui/status';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { useSession } from '~/features/auth/session';
import { useAcceptShipment, useCourier, useCourierBoard, useSetOnline } from '~/features/couriers/queries';
import { useRealtimeRefresh } from '~/lib/realtime';
import { colors, radius } from '~/theme/tokens';

export default function CourierHome() {
  const router = useRouter();
  const { profile } = useSession();
  const courier = useCourier();
  const online = Boolean(courier.data?.is_online);
  const board = useCourierBoard(online);
  const setOnline = useSetOnline();
  const accept = useAcceptShipment();
  // Se actualiza solo cuando un negocio marca listo o alguien toma un pedido.
  useRealtimeRefresh('shipments', '*', ['courier-board']);

  const mine = board.data?.mine ?? [];
  const open = board.data?.open ?? [];

  return (
    <Screen edges={['top']} refreshing={board.isRefetching} onRefresh={() => void board.refetch()}>
      <PanelHeader title={`Hola, ${profile?.full_name.split(' ')[0] || 'repartidor'}`} subtitle="Tus entregas y los pedidos listos para recoger." />

      <View style={[styles.shift, online && styles.shiftOn]}>
        {online && <PatternBackground variant="green" tile={72} />}
        <View style={styles.shiftContent}>
          <OnlineDot online={online} />
          <View style={styles.flex}>
            <Text variant="heading" tone={online ? 'white' : 'default'}>
              {online ? 'En turno' : 'Fuera de turno'}
            </Text>
            <Text variant="small" style={{ color: online ? 'rgba(255,255,255,0.85)' : colors.mutedForeground }}>
              {online ? 'Recibes los pedidos listos para recoger.' : 'Ponte en turno para ver y aceptar pedidos.'}
            </Text>
          </View>
          <Switch
            value={online}
            disabled={setOnline.isPending || courier.isLoading}
            onValueChange={(next) =>
              setOnline.mutate(next, {
                onSuccess: () => toast.success(next ? '¡Estás en turno!' : 'Saliste de turno.'),
                onError: (error) => toast.error(error.message),
              })
            }
            trackColor={{ true: colors.hojaClara, false: colors.border }}
            thumbColor={colors.white}
            accessibilityLabel="En turno"
          />
        </View>
      </View>

      <View>
        <SectionTitle title={`Mis entregas activas (${mine.length})`} />
        {board.isLoading ? (
          <Skeleton height={80} />
        ) : mine.length === 0 ? (
          <Text variant="small" tone="muted">
            No tienes entregas en curso.
          </Text>
        ) : (
          <View style={styles.list}>
            {mine.map((d, i) => {
              const [label, tone] = SHIPMENT_STATUS[d.status];
              return (
                <Animated.View key={d.id} entering={FadeInDown.delay(i * 60)} layout={LinearTransition}>
                  <Card onPress={() => router.push(`/repartidor/entrega/${d.id}`)} style={styles.row}>
                    <View style={styles.flex}>
                      <View style={styles.inline}>
                        <Text variant="bodyMedium">{d.order_number}</Text>
                        <Badge tone={badgeTone(tone)}>{label}</Badge>
                      </View>
                      <Text variant="small" tone="muted" numberOfLines={2}>
                        {d.business} → {d.customer} · {d.municipality}
                        {d.attempts > 0 ? ` · ${d.attempts} intento(s) fallido(s)` : ''}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.mutedForeground} />
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <SectionTitle title={`Disponibles (${online ? open.length : 0})`} />
        <Text variant="small" tone="muted" style={styles.hint}>
          El primero que acepta se lo lleva.
        </Text>
        {!online ? (
          <EmptyState icon={PackageSearch} title="Ponte en turno para ver pedidos" />
        ) : open.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No hay pedidos esperando" description="Te avisaremos cuando un negocio marque uno como listo." />
        ) : (
          <View style={styles.list}>
            {open.map((item, i) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(i * 60)} layout={LinearTransition}>
                <Card style={styles.available}>
                  <View style={styles.inline}>
                    <Store size={16} color={colors.catarina} />
                    <Text variant="bodyMedium" style={styles.flex}>
                      {item.business}
                    </Text>
                  </View>
                  <Text variant="small" tone="muted">
                    Recoger en {item.business_municipality ?? item.business_address} → entregar en {item.municipality}, {item.department}
                  </Text>
                  <Text variant="small" tone="muted">
                    {item.items} {item.items === 1 ? 'producto' : 'productos'} · listo {formatDate(item.ready_at)}
                  </Text>
                  <Button
                    loading={accept.isPending && accept.variables === item.id}
                    onPress={() =>
                      accept.mutate(item.id, {
                        onSuccess: () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                          toast.success('¡Pedido aceptado! Ve al negocio.');
                          router.push(`/repartidor/entrega/${item.id}`);
                        },
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  >
                    Aceptar pedido
                  </Button>
                </Card>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

/** Punto que late mientras el repartidor está en turno. */
function OnlineDot({ online }: { online: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(online ? withRepeat(withTiming(1.9, { duration: 1100 }), -1, false) : 1);
  }, [online, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }], opacity: online ? 2 - pulse.get() : 0 }));
  return (
    <View style={styles.dotBox}>
      <Animated.View style={[styles.dotRing, ring]} />
      <View style={[styles.dot, { backgroundColor: online ? colors.hojaClara : colors.input }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shift: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  shiftOn: { borderColor: colors.catarina },
  shiftContent: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, zIndex: 1 },
  dotBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.hojaClara },
  dot: { width: 14, height: 14, borderRadius: 7 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  available: { gap: 8 },
  hint: { marginTop: -8, marginBottom: 10 },
});
