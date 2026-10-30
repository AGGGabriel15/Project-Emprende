import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '~/theme/tokens';
import { CountBadge } from './count-badge';
import { Text } from './text';

/** Fila de menú con ícono, etiqueta, contador opcional y flecha. */
export function MenuItem({
  icon: Icon,
  label,
  detail,
  onPress,
  badge,
  last,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  onPress: () => void;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, !last && styles.border, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <Icon size={18} color={colors.catarina} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyMedium">{label}</Text>
        {detail ? (
          <Text variant="small" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <CountBadge count={badge ?? 0} size={22} />
      <ChevronRight size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.muted },
  pressed: { backgroundColor: colors.muted },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.niebla, alignItems: 'center', justifyContent: 'center' },
});
