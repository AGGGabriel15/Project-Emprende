import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowRight, BadgeCheck, Home, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { formatMoney } from '@/lib/format';
import { TIER_INFO } from '@/lib/validations/business';
import type { BusinessTier } from '@/types/domain';
import { Card } from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { supabase } from '~/lib/supabase';
import { colors, radius } from '~/theme/tokens';

export const PERIODS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '365d', label: '12 meses' },
];

export function PeriodFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
      {PERIODS.map((p) => (
        <Pressable key={p.value} onPress={() => onChange(p.value)} style={[styles.period, value === p.value && styles.periodActive]}>
          <Text variant="smallMedium" tone={value === p.value ? 'white' : 'default'}>
            {p.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statIcon}>
        <Icon size={16} color={colors.catarina} />
      </View>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
      {hint ? (
        <Text variant="small" tone="muted" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

type Limits = {
  tier: BusinessTier;
  max_active: number;
  monthly_cap_minor: number | null;
  active_orders: number;
  month_sales_minor: number;
  completed_orders: number;
};

/** Nivel del vendedor y sus límites actuales (rpc my_business_limits, como TierCard del web). */
export function TierCard() {
  const router = useRouter();
  const limits = useQuery({
    queryKey: ['my-business-limits'],
    queryFn: async () => (await supabase.rpc('my_business_limits').maybeSingle<Limits>()).data,
  });
  const data = limits.data;
  if (!data) return null;
  const informal = data.tier === 'informal';
  const Icon = informal ? Home : BadgeCheck;
  const cap = data.monthly_cap_minor === null ? null : Number(data.monthly_cap_minor);
  const sales = Number(data.month_sales_minor);
  const usage = cap ? Math.min(100, Math.round((sales / cap) * 100)) : null;
  return (
    <Card style={styles.tier}>
      <View style={styles.tierRow}>
        <View style={styles.tierIcon}>
          <Icon size={20} color={colors.catarina} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyMedium">{TIER_INFO[data.tier].label}</Text>
          <Text variant="small" tone="muted">
            {data.active_orders} de {data.max_active} pedidos en curso
            {cap !== null ? ` · ${formatMoney(sales)} de ${formatMoney(cap)} este mes` : ''}
          </Text>
        </View>
      </View>
      {usage !== null && <Progress value={usage} />}
      {informal && (
        <Pressable onPress={() => router.push('/vendedor/formalizar')} style={styles.tierLink}>
          <Text variant="smallMedium" tone="primary">
            Subir mis límites
          </Text>
          <ArrowRight size={14} color={colors.catarina} />
        </Pressable>
      )}
    </Card>
  );
}

function Progress({ value }: { value: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(withSpring(value, { damping: 18 }));
  }, [value, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.get()}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

/**
 * Barras de ventas de un solo valor (el título las nombra, sin leyenda).
 * Se tocan para ver el detalle; las barras crecen al aparecer.
 */
export function SalesBars({ data }: { data: { label: string; value: number; detail: string }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const current = selected != null ? data[selected] : null;
  return (
    <View style={styles.chart}>
      <Text variant="small" tone="muted" style={styles.chartValue}>
        {current ? `${current.label}: ${formatMoney(current.value)} · ${current.detail}` : 'Toca una barra para ver el detalle'}
      </Text>
      <View style={styles.bars}>
        {data.map((d, i) => (
          <Bar key={d.label + i} ratio={d.value / max} index={i} active={selected === i} onPress={() => setSelected(i === selected ? null : i)} />
        ))}
      </View>
      <View style={styles.axis}>
        <Text variant="small" tone="muted" style={styles.axisText}>
          {data[0]?.label}
        </Text>
        <Text variant="small" tone="muted" style={styles.axisText}>
          {data[data.length - 1]?.label}
        </Text>
      </View>
    </View>
  );
}

function Bar({ ratio, index, active, onPress }: { ratio: number; index: number; active: boolean; onPress: () => void }) {
  const height = useSharedValue(0);
  useEffect(() => {
    height.set(withDelay(Math.min(index, 30) * 18, withSpring(ratio, { damping: 16 })));
  }, [ratio, index, height]);
  const style = useAnimatedStyle(() => ({ height: `${Math.max(2, height.get() * 100)}%` }));
  return (
    <Pressable onPress={onPress} style={styles.barHit} accessibilityRole="button">
      <Animated.View style={[styles.bar, active && styles.barActive, style]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periods: { gap: 8 },
  period: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  periodActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  stat: { flex: 1, minWidth: '46%', gap: 2 },
  statIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  hint: { fontSize: 11 },
  tier: { gap: 10 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center' },
  tierLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.catarina },
  chart: { gap: 8 },
  chartValue: { minHeight: 18 },
  bars: { height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.hojaClara },
  barActive: { backgroundColor: colors.catarina },
  axis: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  axisText: { fontSize: 11 },
});
