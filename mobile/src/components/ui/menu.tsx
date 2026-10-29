import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radius } from '~/theme/tokens';
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
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
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
  badge: { minWidth: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.brote, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontFamily: fonts.sansBold, color: colors.white },
});
