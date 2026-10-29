import { Image } from 'expo-image';
import {
  AlertTriangle,
  Ban,
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  HandHeart,
  KeyRound,
  Package,
  PackageCheck,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, timelineSteps } from '@/features/orders/status';
import { formatDate } from '@/lib/format';
import type { OrderStatus, OrderStatusHistory, ServiceType } from '@/types/domain';
import { Badge } from '~/components/ui/badge';
import { IconButton } from '~/components/ui/button';
import { badgeTone } from '~/components/ui/status';
import { Text } from '~/components/ui/text';
import { colors, radius } from '~/theme/tokens';

export const ORDER_STATUS_ICON = {
  pending_payment: Clock,
  preparing: ChefHat,
  ready: Package,
  ready_for_pickup: PackageCheck,
  on_the_way: Bike,
  delivered: HandHeart,
  disputed: AlertTriangle,
  completed: CheckCircle2,
  cancelled: Ban,
  refunded: RotateCcw,
  returned: Undo2,
} satisfies Record<OrderStatus, unknown>;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={badgeTone(ORDER_STATUS_TONE[status])} icon={ORDER_STATUS_ICON[status]}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Línea de tiempo según order_status_history (misma lógica que OrderTimeline del web). */
export function OrderTimeline({ status, service, history }: { status: OrderStatus; service: ServiceType; history: OrderStatusHistory[] }) {
  const reachedAt = new Map(history.map((h) => [h.to_status, h.created_at]));
  const detour = (['cancelled', 'returned', 'disputed', 'refunded'] as OrderStatus[]).filter((s) => reachedAt.has(s) || s === status);
  const cancelled = status === 'cancelled' || status === 'refunded' || status === 'returned';
  const steps: OrderStatus[] = detour.length
    ? [...timelineSteps(service).filter((s) => reachedAt.has(s) && s !== 'completed'), ...detour, ...(status === 'completed' ? (['completed'] as const) : [])]
    : timelineSteps(service);
  const currentIndex = steps.indexOf(status);

  return (
    <View>
      {steps.map((step, index) => {
        const done = index < currentIndex || (index === currentIndex && (step === 'completed' || cancelled));
        const current = index === currentIndex && !done;
        const bad = step === 'cancelled' || step === 'refunded' || step === 'returned' || step === 'disputed';
        const Icon = ORDER_STATUS_ICON[step];
        const at = reachedAt.get(step);
        const note = history.find((h) => h.to_status === step)?.note;
        const ring = bad && (done || current) ? styles.bad : done ? styles.done : current ? styles.current : styles.todo;
        return (
          <View key={step} style={styles.step}>
            {index < steps.length - 1 && <View style={[styles.rail, index < currentIndex && styles.railDone]} />}
            {current ? <Pulse>{<StepIcon ring={ring} icon={<Icon size={16} color={colors.catarina} />} />}</Pulse> : (
              <StepIcon
                ring={ring}
                icon={done && !bad ? <Check size={16} color={colors.white} /> : <Icon size={16} color={bad ? colors.danger : colors.mutedForeground} />}
              />
            )}
            <View style={styles.stepText}>
              <Text variant={done || current ? 'bodyMedium' : 'body'} tone={done || current ? 'default' : 'muted'}>
                {ORDER_STATUS_LABEL[step]}
                {current ? <Text variant="small" tone="primary">{'  · Estado actual'}</Text> : null}
              </Text>
              {at && (
                <Text variant="small" tone="muted">
                  {formatDate(at)}
                </Text>
              )}
              {note && (bad || step === 'on_the_way' || step === 'delivered') ? <Text variant="small">{note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StepIcon({ ring, icon }: { ring: object; icon: React.ReactNode }) {
  return <View style={[styles.icon, ring]}>{icon}</View>;
}

/** Late suave para llamar la atención (paso actual, PIN cuando llega el repartidor). */
export function Pulse({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(active ? withRepeat(withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })), -1) : 1);
  }, [active, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** PIN de 4 dígitos: se resalta cuando el repartidor llegó. */
export function PinCard({ pin, arrived, delivery }: { pin: string; arrived: boolean; delivery: boolean }) {
  return (
    <Pulse active={arrived}>
      <View style={[styles.pin, arrived && styles.pinArrived]}>
        <View style={styles.pinIcon}>
          <KeyRound size={20} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyMedium">{arrived ? '¡Tu repartidor llegó! Este es tu PIN' : 'Tu PIN de entrega'}</Text>
          <Text variant="small" tone="muted">
            {delivery
              ? 'Dáselo al repartidor solo cuando tengas el pedido y lo hayas revisado.'
              : 'Dáselo en el negocio solo cuando te entreguen el pedido y lo hayas revisado.'}
          </Text>
        </View>
        <Text style={styles.pinDigits} accessibilityLabel={`PIN ${pin.split('').join(' ')}`}>
          {pin}
        </Text>
      </View>
    </Pulse>
  );
}

/** Fotos de cada paso (empacado, recogido, entregado); se tocan para verlas grandes. */
export function EvidenceGallery({ items }: { items: { label: string; url?: string | null; at?: string | null }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const visible = items.filter((i) => i.url);
  if (!visible.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
        {visible.map((item) => (
          <Pressable key={item.label} onPress={() => setOpen(item.url!)} style={styles.evidence}>
            <Image source={item.url} style={styles.evidenceImage} contentFit="cover" />
            <Text variant="smallMedium" numberOfLines={1}>
              {item.label}
            </Text>
            {item.at && (
              <Text variant="small" tone="muted">
                {formatDate(item.at)}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.viewer}>
          {open && <Image source={open} style={styles.viewerImage} contentFit="contain" />}
          <View style={styles.viewerClose}>
            <IconButton icon={X} label="Cerrar" tone="glass" onPress={() => setOpen(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step: { flexDirection: 'row', gap: 14, paddingBottom: 18 },
  rail: { position: 'absolute', left: 17, top: 38, bottom: 0, width: 2, backgroundColor: colors.border },
  railDone: { backgroundColor: colors.catarina },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  current: { backgroundColor: colors.niebla, borderColor: colors.catarina },
  todo: { backgroundColor: colors.card, borderColor: colors.border },
  bad: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  stepText: { flex: 1, paddingTop: 6, gap: 2 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.hojaClara,
    backgroundColor: colors.niebla,
  },
  pinArrived: { borderColor: colors.catarina, backgroundColor: '#DCEFE2' },
  pinIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.catarina, alignItems: 'center', justifyContent: 'center' },
  pinDigits: { fontFamily: 'Outfit_600SemiBold', fontSize: 34, letterSpacing: 6, color: colors.catarina },
  gallery: { gap: 12 },
  evidence: { width: 150, gap: 4 },
  evidenceImage: { width: 150, height: 150, borderRadius: radius.md, backgroundColor: colors.muted },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 48, right: 16 },
});
