import type { LucideIcon } from 'lucide-react-native';
import { Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { PatternBackground } from '~/components/brand/pattern';
import { colors, radius } from '~/theme/tokens';
import { Text } from './text';

/** Estado vacío con el patrón de la marca. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <PatternBackground variant="light" tile={72} />
        <View style={styles.emptyIcon}>
          <Icon size={26} color={colors.catarina} />
        </View>
      </View>
      <View style={styles.emptyText}>
        <Text variant="heading" style={styles.center}>
          {title}
        </Text>
        {description && (
          <Text variant="small" tone="muted" style={styles.center}>
            {description}
          </Text>
        )}
      </View>
      {action}
    </View>
  );
}

/** Bloque gris que late mientras carga. */
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: DimensionValue; style?: StyleProp<ViewStyle> }) {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return <Animated.View style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.niebla }, animated, style]} />;
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={uri} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text variant="smallMedium" tone="primary" style={{ fontSize: size * 0.36 }}>
          {initials || '·'}
        </Text>
      )}
    </View>
  );
}

/** Estrellas de calificación; con `onChange` se pueden tocar. */
export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (value: number) => void }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <Star size={size} color={filled ? '#E3A008' : colors.input} fill={filled ? '#E3A008' : 'transparent'} />;
        return onChange ? (
          <Pressable key={n} hitSlop={6} onPress={() => onChange(n)} accessibilityLabel={`${n} estrellas`}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 14,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  emptyArt: {
    width: '100%',
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    zIndex: 1,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { gap: 4, alignItems: 'center' },
  center: { textAlign: 'center' },
  avatar: { backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stars: { flexDirection: 'row', gap: 2 },
});
