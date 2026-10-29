import { Flower2, Gem, Lamp, Package, Palette, Sprout, Star } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { OpenState } from '@/features/businesses/hours';
import type { PlatformCategory } from '@/types/domain';
import { Text } from '~/components/ui/text';
import { colors, radius } from '~/theme/tokens';

/** Mismos íconos de categoría que el web (CATEGORY_ICONS). */
const CATEGORY_ICONS = { palette: Palette, sprout: Sprout, 'flower-2': Flower2, lamp: Lamp, gem: Gem, package: Package } as const;

export function CategoryIcon({ icon, size = 18, color = colors.catarina }: { icon?: string | null; size?: number; color?: string }) {
  const Icon = CATEGORY_ICONS[(icon ?? 'package') as keyof typeof CATEGORY_ICONS] ?? Package;
  return <Icon size={size} color={color} />;
}

/** "Abierto · Cierra a las 5:00 p. m." / "Cerrado · Abre mañana…" */
export function OpenBadge({ state }: { state: OpenState }) {
  return (
    <View style={styles.open}>
      <View style={[styles.dot, { backgroundColor: state.open ? colors.catarina : colors.input }]} />
      <Text variant="small" tone={state.open ? 'primary' : 'muted'} numberOfLines={1} style={styles.openText}>
        <Text variant="smallMedium" tone={state.open ? 'primary' : 'muted'}>
          {state.label}
        </Text>
        {state.detail ? ` · ${state.detail}` : ''}
      </Text>
    </View>
  );
}

export function Rating({ value, count }: { value: number; count: number }) {
  if (!count) {
    return (
      <Text variant="small" tone="muted">
        Nuevo
      </Text>
    );
  }
  return (
    <View style={styles.rating}>
      <Star size={13} color="#E3A008" fill="#E3A008" />
      <Text variant="smallMedium">{Number(value).toFixed(1)}</Text>
      <Text variant="small" tone="muted">
        ({count})
      </Text>
    </View>
  );
}

/** Chips horizontales de categorías ("Todo" + categorías de la plataforma). */
export function CategoryChips({
  categories,
  active,
  onChange,
}: {
  categories: PlatformCategory[];
  active?: number;
  onChange: (categoryId?: number) => void;
}) {
  const chips = [{ id: undefined, name: 'Todo', icon: null as string | null }, ...categories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chips.map((c) => {
        const selected = active === c.id;
        return (
          <Pressable
            key={c.id ?? 'todo'}
            onPress={() => onChange(c.id)}
            style={[styles.chip, selected && styles.chipActive]}
            accessibilityState={{ selected }}
          >
            {c.icon && <CategoryIcon icon={c.icon} size={16} color={selected ? colors.white : colors.catarina} />}
            <Text variant="smallMedium" tone={selected ? 'white' : 'default'}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  open: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  openText: { flexShrink: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
});
